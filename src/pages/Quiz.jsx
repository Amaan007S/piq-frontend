import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FaInfoCircle } from "react-icons/fa";
import Lottie from "lottie-react";
import { db } from "../firebase";
import { usePiAuth } from "../contexts/PiAuthContext";
import { usePowerUp } from "../contexts/PowerUpContext";
import { useStreak } from "../contexts/StreakContext";
import { getDailyQuiz, getLocalDateKey } from "../data/quizBank";
import { powerUpsConfig } from "../config/powerUpsConfig";
import correctSound from "../assets/sounds/correct.mp3";
import wrongSound from "../assets/sounds/wrong.mp3";
import powerupSound from "../assets/sounds/powerup.mp3";
import timerEndsSound from "../assets/sounds/TimerEnds.mp3";
import quizCompleteAnimation from "../assets/animations/quizComplete.json";

const QUIZ_TIME_LIMIT = 30;

const playSound = (sound) => {
  const audio = new Audio(sound);
  audio.play();
};

const Quiz = () => {
  const navigate = useNavigate();
  const animationRef = useRef(null);
  const hasAwardedScoreRef = useRef(false);
  const autoAdvanceTimeoutRef = useRef(null);

  const { user, authStatus } = usePiAuth();
  const { ownedPowerUps, triggerPowerUp } = usePowerUp();
  const { streak, setStreak, resetStreak, maxStreak, setMaxStreak, addScore } = useStreak();

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const dailyQuiz = useMemo(() => getDailyQuiz(), []);
  const totalQuestions = dailyQuiz.length;

  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerStatus, setAnswerStatus] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_LIMIT);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isSecondChance, setIsSecondChance] = useState(false);
  const [showFireAnimation, setShowFireAnimation] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [progressLoading, setProgressLoading] = useState(true);
  const [dailyProgress, setDailyProgress] = useState(null);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [powerUpUsage, setPowerUpUsage] = useState({
    "Extra Time": 0,
    "Skip Question": 0,
    "Second Chance": 0,
  });

  const currentItem = dailyQuiz[currentQuestion];
  const alreadyPlayedToday =
    dailyProgress?.completed === true && dailyProgress?.lastPlayedDate === todayKey;

  useEffect(() => {
    const loadDailyProgress = async () => {
      if (authStatus === "loading") return;

      if (authStatus !== "success" || !user?.username) {
        setProgressLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.username);
        const userSnap = await getDoc(userRef);
        const progress = userSnap.exists() ? userSnap.data()?.dailyProgress ?? null : null;
        setDailyProgress(progress);
      } catch (error) {
        console.error("Failed to load daily quiz progress:", error);
      } finally {
        setProgressLoading(false);
      }
    };

    loadDailyProgress();
  }, [authStatus, user]);

  useEffect(() => {
    if (quizFinished || !quizStarted || !isTimerActive) return;

    if (timeLeft === 0) {
      playSound(timerEndsSound);
      setAnswerStatus("time-up");
      setIsTimerActive(false);
      resetStreak();
      return;
    }

    const timer = setTimeout(() => setTimeLeft((previous) => previous - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, quizFinished, quizStarted, isTimerActive, resetStreak]);

  useEffect(() => () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }
  }, []);

  const persistDailyProgress = useCallback(
    async (finalScore) => {
      if (!user?.username) return;

      const nextProgress = {
        lastPlayedDate: todayKey,
        score: finalScore,
        completed: true,
      };

      await setDoc(
        doc(db, "users", user.username),
        { dailyProgress: nextProgress },
        { merge: true }
      );

      setDailyProgress(nextProgress);
    },
    [todayKey, user]
  );

  const finishQuiz = useCallback(
    async (finalScore) => {
      if (isSavingProgress) return;

      setIsSavingProgress(true);
      setIsTimerActive(false);

      try {
        if (!hasAwardedScoreRef.current && finalScore > 0) {
          addScore(finalScore);
          hasAwardedScoreRef.current = true;
        }

        await persistDailyProgress(finalScore);
      } catch (error) {
        console.error("Failed to save daily quiz progress:", error);
        toast.error("We could not save today's result. Please try again.", {
          style: {
            background: "#1F1F1F",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "12px",
          },
        });
      } finally {
        setIsSavingProgress(false);
        setQuizFinished(true);
      }
    },
    [addScore, isSavingProgress, persistDailyProgress]
  );

  const handleNext = useCallback(
    async (nextScore = score) => {
      setSelectedOption(null);
      setAnswerStatus(null);
      setIsTransitioning(false);
      setTimeLeft(QUIZ_TIME_LIMIT);
      setIsTimerActive(true);
      setIsSecondChance(false);

      if (currentQuestion + 1 < totalQuestions) {
        setCurrentQuestion((previous) => previous + 1);
        return;
      }

      await finishQuiz(nextScore);
    },
    [currentQuestion, finishQuiz, score, totalQuestions]
  );

  const handleConfirmAnswer = () => {
    if (selectedOption === null || !currentItem) return;

    if (selectedOption === currentItem.correctIndex) {
      playSound(correctSound);
      toast.success("Nice one \uD83D\uDD25", {
        duration: 900,
        style: {
          background: "#1F1F1F",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: "12px",
        },
      });
      setAnswerStatus("correct");
      setIsTimerActive(false);
      setIsTransitioning(true);
      const nextScore = score + 1;
      setScore((previous) => previous + 1);
      setStreak((previous) => {
        const nextStreak = (previous ?? 0) + 1;
        setMaxStreak((previousMax) => Math.max(previousMax ?? 0, nextStreak));

        if (nextStreak > 0 && nextStreak % 5 === 0) {
          setShowFireAnimation(true);
          setTimeout(() => setShowFireAnimation(false), 1000);
        }

        return nextStreak;
      });

      autoAdvanceTimeoutRef.current = setTimeout(() => {
        handleNext(nextScore);
      }, 300);
      return;
    }

    playSound(wrongSound);
    setIsTimerActive(false);

    if (
      ownedPowerUps["Second Chance"] > 0 &&
      powerUpUsage["Second Chance"] < 1 &&
      !isSecondChance
    ) {
      toast((toastId) => (
        <div>
          <p className="mb-2 text-white">Wrong answer. Use Second Chance to retry?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                triggerPowerUp("Second Chance");
                setPowerUpUsage((previous) => ({
                  ...previous,
                  "Second Chance": previous["Second Chance"] + 1,
                }));
                setIsSecondChance(true);
                setAnswerStatus(null);
                setSelectedOption(null);
                setIsTimerActive(true);
                toast.dismiss(toastId);
                toast("Second Chance activated. Try again.", {
                  icon: <FaInfoCircle style={{ color: "#FFC107" }} />,
                  style: {
                    background: "#1F1F1F",
                    color: "#fff",
                    border: "1px solid #333",
                    borderRadius: "12px",
                  },
                });
              }}
              className="rounded bg-green-500 px-4 py-2 text-black hover:bg-green-400"
            >
              Yes, retry
            </button>
            <button
              onClick={() => {
                setAnswerStatus("wrong");
                resetStreak();
                toast.dismiss(toastId);
              }}
              className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ), {
        style: {
          background: "#1F1F1F",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: "12px",
        },
      });
      return;
    }

    setAnswerStatus("wrong");
    resetStreak();
  };

  const handleUsePowerUp = async (powerUpName) => {
    const config = powerUpsConfig.find((item) => item.name === powerUpName);
    if (!config) return;

    if (ownedPowerUps[powerUpName] <= 0) {
      toast.error(`You don't have any ${powerUpName} left.`, {
        style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
      });
      return;
    }

    if (powerUpUsage[powerUpName] >= config.limit) {
      toast.error(`You reached the limit for ${powerUpName}.`, {
        style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
      });
      return;
    }

    playSound(powerupSound);
    triggerPowerUp(powerUpName);
    setPowerUpUsage((previous) => ({
      ...previous,
      [powerUpName]: previous[powerUpName] + 1,
    }));

    if (powerUpName === "Skip Question") {
      const nextScore = score + 1;
      setScore(nextScore);
      setAnswerStatus("skipped");
      await handleNext(nextScore);
    } else if (powerUpName === "Extra Time") {
      setTimeLeft((previous) => previous + 10);
      setIsTimerActive(true);
    }

    toast.success(`${powerUpName} used.`, {
      style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
    });
  };

  if (progressLoading || authStatus === "loading" || streak === null || maxStreak === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] px-6 text-center text-white">
        <div>
          <h1 className="text-3xl font-semibold">Loading today's quiz</h1>
          <p className="mt-3 text-sm text-zinc-400">We are preparing your 10 daily questions.</p>
        </div>
      </div>
    );
  }

  if (alreadyPlayedToday) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212] px-6 text-center text-white">
        <div className="max-w-xl rounded-3xl bg-[#1F1F1F] p-8 shadow-lg">
          <h1 className="text-3xl font-bold">Already Played</h1>
          <p className="mt-3 text-zinc-300">You already completed today's daily quiz.</p>
          <p className="mt-2 text-sm text-zinc-400">Today's score: {dailyProgress?.score ?? 0} / {totalQuestions}</p>
          <button
            onClick={() => navigate("/store")}
            className="mt-6 rounded-2xl bg-yellow-400 px-6 py-3 font-semibold text-black transition hover:bg-yellow-300"
          >
            Boost your next run
          </button>
          <p className="mt-4 text-sm text-zinc-400">Don't break your streak tomorrow.</p>
        </div>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212] px-6 text-center text-white">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl font-bold md:text-4xl"
        >
          Daily Crypto Quiz
        </motion.h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-300 md:text-base">
          Today's quiz has 10 questions with a fair mix of easy, medium, and hard difficulty.
        </p>
        <p className="mt-2 text-sm text-zinc-400">7 easy ? 2 medium ? 1 hard</p>
        <p className="mt-3 text-sm text-yellow-300">Don't break your streak tomorrow.</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setQuizStarted(true)}
          className="mt-8 rounded-2xl bg-yellow-400 px-8 py-4 text-lg font-semibold text-black transition hover:bg-yellow-300"
        >
          Start Quiz
        </motion.button>
      </div>
    );
  }

  if (quizFinished) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#121212] px-4 text-center text-white">
        <Lottie
          lottieRef={animationRef}
          animationData={quizCompleteAnimation}
          loop={false}
          autoplay
          className="mb-6 h-72 w-72"
          onComplete={() => {
            if (animationRef.current) {
              animationRef.current.goToAndStop(114, true);
            }
          }}
        />

        <h1 className="mb-2 text-4xl font-bold">{"\uD83D\uDD25"} Daily Challenge Complete</h1>
        <p className="mb-1 text-2xl">Score: {score} / {totalQuestions}</p>
        <p className="mt-2 text-base text-zinc-300">You're getting better ? keep the streak alive.</p>
        <p className="mb-6 mt-3 text-lg text-zinc-400">Max Streak: {maxStreak}</p>
        <button
          onClick={() => navigate("/store")}
          className="rounded-2xl bg-yellow-400 px-6 py-3 font-semibold text-black transition hover:bg-yellow-300"
        >
          Boost your next run
        </button>
        <p className="mt-4 text-sm text-zinc-400">Don't break your streak tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 text-white md:flex-row">
      <div className="relative flex-1 rounded-xl bg-[#1F1F1F]/90 p-6 shadow-lg backdrop-blur-md">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: `${Math.min((timeLeft / QUIZ_TIME_LIMIT) * 100, 100)}%` }}
          transition={{ duration: 0.92, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-0 top-0 h-2 rounded-full bg-yellow-400"
        />

        <div className="mt-1 mb-3 flex flex-col justify-between gap-3 md:flex-row">
          <div>
            <h2 className="text-lg font-semibold md:text-xl">Time Left: {timeLeft}s</h2>
            <h2 className="text-lg font-semibold md:text-xl">Score: {score}</h2>
            <p className="mt-1 text-sm text-zinc-400">Question {currentQuestion + 1} of {totalQuestions}</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.span
              animate={showFireAnimation ? { scale: [1, 1.5, 1], opacity: [1, 0.8, 1] } : {}}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className={`text-2xl ${streak > 0 && streak % 5 === 0 ? "text-yellow-400" : ""}`}
            >
              {"\uD83D\uDD25"}
            </motion.span>
            <h2 className={`text-lg font-semibold md:text-xl ${streak > 0 && streak % 5 === 0 ? "text-yellow-400" : ""}`}>
              Streak: {streak}
            </h2>
          </div>
        </div>

        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h3 className="mb-4 text-2xl font-bold">{currentItem.question}</h3>
          <div className="grid gap-4">
            {currentItem.options.map((option, idx) => (
              <motion.button
                key={`${currentItem.id}-${option}`}
                onClick={() => setSelectedOption(idx)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-xl px-4 py-3 text-left transition ${
                  selectedOption === idx
                    ? answerStatus === "correct"
                      ? "bg-green-500 text-black"
                      : answerStatus === "wrong"
                      ? "bg-red-500 text-black"
                      : "bg-yellow-400 text-black"
                    : (answerStatus === "wrong" || answerStatus === "time-up") && idx === currentItem.correctIndex
                    ? "bg-green-500 text-black"
                    : "bg-[#333] hover:bg-yellow-500 hover:text-black"
                }`}
                disabled={answerStatus !== null || isSavingProgress}
              >
                {option}
              </motion.button>
            ))}
          </div>
        </motion.div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            onClick={handleConfirmAnswer}
            disabled={selectedOption === null || answerStatus !== null || isSavingProgress}
            className="rounded-2xl bg-green-500 px-6 py-3 text-black transition hover:bg-green-400 disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => handleNext()}
            disabled={answerStatus === null || isSavingProgress || isTransitioning}
            className={`${currentQuestion + 1 === totalQuestions ? "bg-red-500 hover:bg-red-400" : "bg-blue-500 hover:bg-blue-400"} rounded-2xl px-6 py-3 text-white transition disabled:opacity-50`}
          >
            {currentQuestion + 1 === totalQuestions ? (isSavingProgress ? "Saving..." : "Finish") : "Next"}
          </button>
        </div>

        {answerStatus === "time-up" && <p className="mt-4 font-bold text-red-500">Time's up!</p>}
      </div>

      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-yellow-500 bg-[#121212] shadow-[0_-2px_10px_rgba(255,255,255,0.05)] backdrop-blur-md md:hidden"
      >
        <div className="flex items-center justify-around gap-2 px-3 py-2">
          {powerUpsConfig.map(({ name, label, icon, limit }) => {
            const isDisabled = ownedPowerUps[name] <= 0 || powerUpUsage[name] >= limit;

            return (
              <div key={name} className="group flex flex-col items-center gap-1 px-2 transition active:scale-95">
                <button
                  onClick={() => {
                    if (isDisabled) {
                      const message =
                        ownedPowerUps[name] <= 0
                          ? `No ${name} power-ups available.`
                          : `Usage limit for ${name} has been reached.`;

                      toast.error(message, {
                        style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
                      });
                      return;
                    }

                    handleUsePowerUp(name);
                  }}
                  className={`rounded-full p-3 shadow-md transition ${isDisabled ? "cursor-pointer bg-gray-500" : "bg-yellow-400 group-hover:bg-yellow-300"}`}
                >
                  {icon}
                </button>
                <span className={`text-[11px] font-medium ${isDisabled ? "text-gray-400 opacity-50" : "text-white opacity-90 group-hover:opacity-100"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      <div className="w-full rounded-2xl bg-[#1F1F1F] p-6 shadow-lg md:w-1/3">
        <h2 className="mb-6 text-2xl font-bold text-yellow-400">Power-Ups</h2>
        <div className="flex flex-col gap-6">
          {powerUpsConfig.map(({ name, description, limit }) => (
            <div key={name} className="flex items-center justify-between rounded-xl bg-[#2A2A2A] p-4">
              <div>
                <h4 className="font-semibold">{name}</h4>
                <p className="text-sm text-gray-400">
                  {powerUpUsage[name]} / {limit} (Total: {ownedPowerUps[name] || 0})
                </p>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
              <button
                disabled={ownedPowerUps[name] <= 0 || powerUpUsage[name] >= limit}
                onClick={() => handleUsePowerUp(name)}
                className={`rounded-xl px-4 py-2 font-bold text-black transition ${ownedPowerUps[name] > 0 && powerUpUsage[name] < limit ? "bg-yellow-400 hover:bg-yellow-300" : "cursor-not-allowed bg-gray-500"}`}
              >
                Use
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/store")}
          className="mt-8 w-full rounded-2xl bg-blue-500 px-6 py-3 text-white transition hover:bg-blue-400"
        >
          Go to Power-Ups Store
        </button>
      </div>
    </div>
  );
};

export default Quiz;


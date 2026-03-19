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
import { DEV_BYPASS_USERS } from "../utils/devConfig";
import correctSound from "../assets/sounds/correct.mp3";
import wrongSound from "../assets/sounds/wrong.mp3";
import powerupSound from "../assets/sounds/powerup.mp3";
import timerEndsSound from "../assets/sounds/TimerEnds.mp3";
import quizCompleteAnimation from "../assets/animations/quizComplete.json";

const QUIZ_TIME_LIMIT = 30;
const FIRE_ICON = "\uD83D\uDD25";
const DOT = "\u2022";

const playSound = (sound) => {
  const audio = new Audio(sound);
  audio.play();
};

const HeaderCard = ({ label, value, accent = false }) => (
  <div className="rounded-xl bg-[#1F1F1F] px-3 py-2 text-center">
    <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
    <p className={`mt-0.5 text-sm font-semibold sm:text-base ${accent ? "text-yellow-400" : "text-white"}`}>
      {value}
    </p>
  </div>
);

const Quiz = () => {
  const navigate = useNavigate();
  const animationRef = useRef(null);
  const autoAdvanceTimeoutRef = useRef(null);
  const hasAwardedScoreRef = useRef(false);
  const quizAreaRef = useRef(null);
  const quizStartedRef = useRef(false);
  const quizFinishedRef = useRef(false);
  const isTimerActiveRef = useRef(true);

  const { user, authStatus } = usePiAuth();
  const { ownedPowerUps, triggerPowerUp } = usePowerUp();
  const { streak, setStreak, resetStreak, maxStreak, setMaxStreak, addScore } = useStreak();

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const dailyQuiz = useMemo(() => getDailyQuiz(), []);
  const totalQuestions = dailyQuiz.length;
  const isDevBypassUser = DEV_BYPASS_USERS.includes(user?.username || "");

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
  const hasCompletedToday =
    dailyProgress?.completed === true && dailyProgress?.lastPlayedDate === todayKey;
  const alreadyPlayedToday = hasCompletedToday && !isDevBypassUser;
  const isQuizActive = quizStarted && !quizFinished && !alreadyPlayedToday && !progressLoading;
  const powerUpsEnabled = isQuizActive && Boolean(currentItem);
  const canAdvance = answerStatus !== null && !isSavingProgress && !isTransitioning;
  const finalizeWrongAnswer = useCallback(() => {
    setAnswerStatus("wrong");
    setIsSecondChance(true);
    setIsTransitioning(false);
    setIsTimerActive(false);
    isTimerActiveRef.current = false;
    resetStreak();
  }, [resetStreak]);

  useEffect(() => {
    quizStartedRef.current = quizStarted;
  }, [quizStarted]);

  useEffect(() => {
    quizFinishedRef.current = quizFinished;
  }, [quizFinished]);

  useEffect(() => {
    isTimerActiveRef.current = isTimerActive;
  }, [isTimerActive]);

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
    const timer = setInterval(() => {
      if (!quizStartedRef.current || quizFinishedRef.current || !isTimerActiveRef.current) {
        return;
      }

      setTimeLeft((previous) => {
        if (previous <= 1) {
          playSound(timerEndsSound);
          setAnswerStatus("time-up");
          setIsTimerActive(false);
          isTimerActiveRef.current = false;
          resetStreak();
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resetStreak]);

  useEffect(
    () => () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!quizAreaRef.current) return;
    if (!quizStarted || quizFinished || alreadyPlayedToday || progressLoading) return;

    quizAreaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [alreadyPlayedToday, currentQuestion, progressLoading, quizFinished, quizStarted]);

  const persistDailyProgress = useCallback(
    async (finalScore) => {
      if (!user?.username) return;
      if (isDevBypassUser && hasCompletedToday) {
        return;
      }

      const nextProgress = {
        lastPlayedDate: todayKey,
        score: finalScore,
        completed: true,
      };

      await setDoc(doc(db, "users", user.username), { dailyProgress: nextProgress }, { merge: true });
      setDailyProgress(nextProgress);
    },
    [hasCompletedToday, isDevBypassUser, todayKey, user]
  );

  const finishQuiz = useCallback(
    async (finalScore) => {
      if (isSavingProgress) return;

      setIsSavingProgress(true);
      setIsTimerActive(false);
      isTimerActiveRef.current = false;

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
      isTimerActiveRef.current = true;
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
      toast.success(`Nice one ${FIRE_ICON}`, {
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
      isTimerActiveRef.current = false;
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
    isTimerActiveRef.current = false;

    if (
      ownedPowerUps["Second Chance"] > 0 &&
      powerUpUsage["Second Chance"] < 1 &&
      !isSecondChance
    ) {
      toast(
        (toastId) => (
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
                  isTimerActiveRef.current = true;
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
                className="min-h-[44px] rounded-xl bg-green-500 px-4 py-2 text-black hover:bg-green-400"
              >
                Yes, retry
              </button>
              <button
                onClick={() => {
                  toast.dismiss(toastId);
                  finalizeWrongAnswer();
                }}
                className="min-h-[44px] rounded-xl bg-red-500 px-4 py-2 text-white hover:bg-red-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        {
          style: {
            background: "#1F1F1F",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "12px",
          },
        }
      );
      return;
    }

    finalizeWrongAnswer();
  };

  const handleUsePowerUp = async (powerUpName) => {
    if (!powerUpsEnabled) {
      toast("Start the quiz to use power-ups.", {
        style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
      });
      return;
    }

    const config = powerUpsConfig.find((item) => item.name === powerUpName);
    if (!config) return;

    if ((ownedPowerUps[powerUpName] || 0) <= 0) {
      toast(`No ${powerUpName} left`, {
        description: "Get more in Store",
        action: {
          label: "Go to Store",
          onClick: () => navigate("/store"),
        },
        style: {
          background: "#1F1F1F",
          color: "#fff",
          border: "1px solid #333",
          borderRadius: "12px",
        },
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
      isTimerActiveRef.current = true;
    }

    toast.success(`${powerUpName} used.`, {
      style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
    });
  };

  const getPowerUpRecommendation = (powerUpName) => {
    if (powerUpName === "Extra Time" && timeLeft <= 10 && answerStatus === null) {
      return true;
    }

    if (powerUpName === "Second Chance" && answerStatus === "wrong") {
      return true;
    }

    if (powerUpName === "Skip Question" && currentItem?.difficulty === "hard" && answerStatus === null) {
      return true;
    }

    return false;
  };

  const renderPowerUpsPanel = ({ compact = false } = {}) => (
    <div className={`flex flex-col ${compact ? "gap-3" : "gap-3.5"}`}>
      {powerUpsConfig.map(({ name, description, label, icon, limit }) => {
        const totalOwned = ownedPowerUps[name] || 0;
        const hasNoneLeft = totalOwned <= 0;
        const reachedLimit = powerUpUsage[name] >= limit;
        const blockedByFlow = !powerUpsEnabled;
        const disabled = blockedByFlow || reachedLimit;
        const recommended = getPowerUpRecommendation(name);

        return (
          <div
            key={name}
            className={`group rounded-2xl border bg-[#191919] text-left transition ${
              recommended
                ? "border-yellow-400/45 ring-1 ring-yellow-400/30 animate-pulse"
                : "border-white/8 hover:border-yellow-400/25"
            } ${compact ? "p-4" : "p-4"} ${hasNoneLeft ? "opacity-90" : "opacity-100"} shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-white">
                  <span className="text-yellow-400">{icon}</span>
                  <h3 className="font-semibold tracking-tight">{name}</h3>
                  {totalOwned > 0 ? (
                    <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
                      {totalOwned}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-gray-400">{description}</p>
              </div>
              <div className="flex min-w-[78px] flex-col items-end gap-1 text-right">
                <span className="rounded-full bg-[#121212] px-2 py-1 text-xs font-medium text-zinc-300">
                  {label}
                </span>
                {recommended ? <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-yellow-400/90">Recommended</span> : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
              <p className="text-sm text-gray-400">
                {powerUpUsage[name]} / {limit} {compact ? null : `(Total: ${totalOwned})`}
              </p>
              <div className="flex min-w-[96px] items-center justify-end gap-2 text-right">
                <span
                  className={
                    hasNoneLeft
                      ? "rounded-md border border-white/10 bg-[#121212] px-2 py-1 text-xs font-medium text-zinc-400"
                      : "rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-400"
                  }
                >
                  {hasNoneLeft ? "0 left" : totalOwned}
                </span>
                {hasNoneLeft ? (
                  <button
                    type="button"
                    onClick={() => navigate("/store")}
                    className="hidden h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-[#121212] text-xs text-zinc-300 opacity-0 transition hover:border-yellow-400/30 hover:text-yellow-300 group-hover:flex group-hover:opacity-100"
                    aria-label={`Get more ${name} in Store`}
                  >
                    +
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUsePowerUp(name)}
                    disabled={disabled}
                    className={`min-h-[34px] rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      disabled
                        ? "cursor-not-allowed bg-transparent text-yellow-400/45"
                        : "bg-transparent text-yellow-400 hover:text-yellow-300"
                    }`}
                  >
                    Use
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderQuizArea = () => {
    if (progressLoading || authStatus === "loading" || streak === null || maxStreak === null) {
      return (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-4 py-8 text-center lg:min-h-full lg:flex-1">
          <h2 className="text-2xl font-semibold text-white">Loading today's quiz</h2>
          <p className="mt-3 max-w-md text-sm text-zinc-400">We are preparing your 10 daily questions.</p>
        </div>
      );
    }

    if (!quizStarted) {
      return (
        <div className="flex min-h-[280px] flex-col items-center justify-center px-4 py-8 text-center lg:min-h-full lg:flex-1">
          <h2 className="text-3xl font-bold text-white">
            {alreadyPlayedToday ? "Today's Quiz Completed" : "Welcome to today's challenge"}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300">
            {alreadyPlayedToday
              ? "You're getting better - keep the streak alive"
              : "10 questions. A clean mix of easy, medium, and hard."}
          </p>
          {alreadyPlayedToday ? (
            <p className="mt-3 text-2xl font-semibold text-white">
              Score: {dailyProgress?.score ?? 0} / {totalQuestions}
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-400">7 easy {DOT} 2 medium {DOT} 1 hard</p>
              <p className="mt-4 text-sm text-yellow-300">Tip: Use power-ups to protect your streak</p>
            </>
          )}
          <p className="mt-4 text-sm text-zinc-400">Don't break your streak tomorrow</p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {!alreadyPlayedToday || isDevBypassUser ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setQuizStarted(true)}
                className="min-h-[44px] rounded-xl bg-yellow-400 px-6 py-3 font-semibold text-black transition hover:bg-yellow-300"
              >
                Start Today's Quiz
              </motion.button>
            ) : null}
            {alreadyPlayedToday ? (
              <>
                <button
                  onClick={() => navigate("/store")}
                  className="min-h-[44px] rounded-xl bg-yellow-400 px-6 py-3 font-semibold text-black transition hover:bg-yellow-300"
                >
                  Boost your next run
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="min-h-[44px] rounded-xl bg-[#2A2A2A] px-6 py-3 font-semibold text-white transition hover:bg-[#333]"
                >
                  Back to Home
                </button>
              </>
            ) : null}
          </div>
        </div>
      );
    }

    if (quizFinished) {
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center px-4 py-8 text-center">
          <Lottie
            lottieRef={animationRef}
            animationData={quizCompleteAnimation}
            loop={false}
            autoplay
            className="mb-4 h-40 w-40 sm:h-48 sm:w-48"
            onComplete={() => {
              if (animationRef.current) {
                animationRef.current.goToAndStop(114, true);
              }
            }}
          />
          <h2 className="text-3xl font-bold text-white">Today's Quiz Completed</h2>
          <p className="mt-3 text-2xl font-semibold text-white">Score: {score} / {totalQuestions}</p>
          <p className="mt-3 max-w-md text-sm leading-6 text-zinc-300">You're getting better - keep the streak alive</p>
          <p className="mt-2 text-sm text-zinc-400">Don't break your streak tomorrow</p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button
              onClick={() => navigate("/store")}
              className="min-h-[44px] rounded-xl bg-yellow-400 px-6 py-3 font-semibold text-black transition hover:bg-yellow-300"
            >
              Boost your next run
            </button>
            <button
              onClick={() => navigate("/")}
              className="min-h-[44px] rounded-xl bg-[#2A2A2A] px-6 py-3 font-semibold text-white transition hover:bg-[#333]"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: `${Math.min((timeLeft / QUIZ_TIME_LIMIT) * 100, 100)}%` }}
          transition={{ duration: 0.92, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-0 top-0 h-2 rounded-full bg-yellow-400"
        />

        <motion.div
          key={currentItem.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col px-4 pt-3 sm:px-5 sm:pt-4"
        >
          <div className="pt-1 sm:pt-2">
            <h3 className="text-lg font-bold leading-snug text-white sm:text-2xl">{currentItem.question}</h3>
          </div>

          <div className="flex flex-col gap-2 pt-3">
            {currentItem.options.map((option, idx) => (
              <motion.button
                key={`${currentItem.id}-${option}`}
                onClick={() => setSelectedOption(idx)}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                className={`min-h-[42px] rounded-xl px-4 py-2 text-left text-sm transition sm:text-base ${
                  selectedOption === idx
                    ? answerStatus === "correct"
                      ? "bg-green-500 text-black ring-2 ring-green-300/40"
                      : answerStatus === "wrong"
                      ? "bg-red-500 text-black ring-2 ring-red-300/40"
                      : "bg-yellow-400 text-black ring-2 ring-yellow-300/50"
                    : (answerStatus === "wrong" || answerStatus === "time-up") && idx === currentItem.correctIndex
                    ? "bg-green-500 text-black ring-2 ring-green-300/40"
                    : "bg-[#333] hover:bg-[#2A2A2A] hover:text-white"
                }`}
                disabled={answerStatus !== null || isSavingProgress}
              >
                {option}
              </motion.button>
            ))}
          </div>

          <div className="mt-2 min-h-[24px] text-left">
            <p className={`text-sm font-bold text-red-500 transition-opacity ${answerStatus === "time-up" ? "opacity-100" : "opacity-0"}`}>
              Time's up!
            </p>
          </div>

          <div className="pt-3 pb-2 sm:pb-4">
            <div className="grid grid-cols-3 gap-2 lg:hidden">
              {powerUpsConfig.map(({ name, icon, limit }) => {
                const totalOwned = ownedPowerUps[name] || 0;
                const hasNoneLeft = totalOwned <= 0;
                const reachedLimit = powerUpUsage[name] >= limit;
                const disabled = !powerUpsEnabled || reachedLimit;
                const recommended = getPowerUpRecommendation(name);

                return (
                  <motion.button
                    key={name}
                    onClick={() => handleUsePowerUp(name)}
                    disabled={disabled}
                    whileTap={{ scale: 0.95 }}
                    className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border bg-[#1A1A1A] px-2 py-2 text-center transition hover:bg-[#222] active:scale-95 ${
                      recommended
                        ? "border-yellow-400/40 ring-1 ring-yellow-400/30 animate-pulse"
                        : "border-white/10 hover:border-yellow-400/30"
                    } ${hasNoneLeft ? "opacity-85" : "opacity-100"} ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="text-base text-yellow-400">{icon}</div>
                    <div className="mt-1 text-[11px] font-medium leading-none text-yellow-400">
                      {hasNoneLeft ? "0" : totalOwned}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="mx-auto mt-2.5 flex w-full max-w-[460px] gap-2 sm:mt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null || answerStatus !== null || isSavingProgress}
                className="min-h-[38px] flex-[1.08] rounded-xl bg-green-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
              >
                Confirm
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNext()}
                disabled={!canAdvance}
                className={`min-h-[38px] flex-1 rounded-xl px-5 py-2 text-sm font-semibold transition ${
                  canAdvance
                    ? "bg-blue-500 text-white shadow-[0_8px_20px_rgba(59,130,246,0.18)] hover:bg-blue-400"
                    : "border border-white/10 bg-transparent text-white/72"
                } disabled:opacity-40`}
              >
                {currentQuestion + 1 === totalQuestions ? (isSavingProgress ? "Saving..." : "Finish") : "Next"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0F0F0F] text-white">
      <header className={`${isQuizActive ? "" : "sticky top-0 z-20 backdrop-blur-sm"} border-b border-white/5 bg-[#0F0F0F]`}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-white sm:text-2xl">Daily Crypto Quiz</h1>
              <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">Quiz first. Power-ups ready when you need them.</p>
            </div>
            <button
              onClick={() => navigate("/store")}
              disabled={isQuizActive}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isQuizActive ? "cursor-not-allowed bg-[#2A2A2A] text-zinc-500" : "bg-blue-500 text-white hover:bg-blue-400"
              }`}
            >
              {isQuizActive ? "Finish this run first" : "Store"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <HeaderCard label="Time" value={`${timeLeft}s`} />
            <HeaderCard label="Score" value={`${score}/${totalQuestions}`} />
            <HeaderCard label="Question" value={`${Math.min(currentQuestion + 1, totalQuestions)}/${totalQuestions}`} />
            <div className="rounded-xl bg-[#1F1F1F] px-3 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Streak</p>
              <div className="mt-0.5 flex items-center justify-center gap-2">
                <motion.span
                  animate={showFireAnimation ? { scale: [1, 1.25, 1], opacity: [1, 0.85, 1] } : {}}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className={`text-base ${streak > 0 && streak % 5 === 0 ? "text-yellow-400" : "text-zinc-300"}`}
                >
                  {FIRE_ICON}
                </motion.span>
                <p className={`text-sm font-semibold sm:text-base ${streak > 0 && streak % 5 === 0 ? "text-yellow-400" : "text-white"}`}>
                  {streak}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-2 sm:px-4 sm:py-3">
        <div className="grid w-full gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-stretch">
          <div className="flex min-w-0 flex-col gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Today's Challenge</p>
            </div>

            <section
              ref={quizAreaRef}
              className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-yellow-400/20 bg-[#1F1F1F]/90 shadow-[0_0_30px_rgba(255,200,0,0.08)]"
            >
              {renderQuizArea()}
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="flex h-full flex-col rounded-2xl border border-white/5 bg-[#1F1F1F] p-4 opacity-95 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
              <div className="mb-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Power-ups</p>
                <p className="mt-1 text-sm text-zinc-400">Use them without leaving the question.</p>
              </div>
              {renderPowerUpsPanel({ compact: true })}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Quiz;
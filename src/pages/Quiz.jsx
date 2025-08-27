import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePowerUp } from "../contexts/PowerUpContext";
import { quizData } from "../data/quizData";
import { toast } from "sonner";
import { FaInfoCircle } from "react-icons/fa";
import { useStreak } from "../contexts/StreakContext";
import { motion } from "framer-motion";
import correctSound from "../assets/sounds/correct.mp3";
import wrongSound from "../assets/sounds/wrong.mp3";
import powerupSound from "../assets/sounds/powerup.mp3";
import TimerEnds from "../assets/sounds/TimerEnds.mp3";
import Lottie from "lottie-react";
import quizCompleteAnimation from "../assets/animations/quizComplete.json";
import { powerUpsConfig } from "../config/powerUpsConfig";

// Sound play helpers
const playSound = (sound) => {
  const audio = new Audio(sound);
  audio.play();
};

const Quiz = () => {
  const navigate = useNavigate();
  const { ownedPowerUps, triggerPowerUp } = usePowerUp();
  const [quizStarted, setQuizStarted] = useState(false); // NEW: Start screen
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerStatus, setAnswerStatus] = useState(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [quizFinished, setQuizFinished] = useState(false);
  const [isSecondChance, setIsSecondChance] = useState(false);
  const { streak, setStreak, resetStreak, maxStreak, setMaxStreak } = useStreak();
  const [showFireAnimation, setShowFireAnimation] = useState(false);
  const animationRef = useRef(null);
  const [isTimerActive, setIsTimerActive] = useState(true);

  const [powerUpUsage, setPowerUpUsage] = useState({
    "Extra Time": 0,
    "Skip Question": 0,
    "Second Chance": 0,
  });

  const powerUpLimits = {
    "Extra Time": 2,
    "Skip Question": 1,
    "Second Chance": 1,
  };

  const handleNext = useCallback(() => {
    setSelectedOption(null);
    setAnswerStatus(null);
    setTimeLeft(30); // Reset the timer
    setIsTimerActive(true); // Restart the timer for the next question
    setIsSecondChance(false);
    if (currentQuestion + 1 < quizData.length) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setQuizFinished(true);
    }
  }, [currentQuestion]);

  useEffect(() => {
    if (quizFinished || !quizStarted || !isTimerActive) return;
  
    if (timeLeft === 0) {
      playSound(TimerEnds);
      setAnswerStatus("time-up"); // Mark the answer as "time-up"
      resetStreak(); // Reset the streak when the timer ends
      return;
    }
  
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, quizFinished, quizStarted, isTimerActive, resetStreak]);

  const handleConfirmAnswer = () => {
    if (selectedOption === quizData[currentQuestion].correctAnswer) {
      playSound(correctSound); // Play correct answer sound
      setAnswerStatus("correct");
      setScore(score + 1);
      setIsTimerActive(false); // Stop the timer
      setStreak((prev) => {
        const newStreak = prev + 1;
        setMaxStreak((prevMax) => Math.max(prevMax, newStreak));
        if (newStreak % 5 === 0) {
          setShowFireAnimation(true);
          setTimeout(() => setShowFireAnimation(false), 1000);
        }
        return newStreak;
      });
    } else {
      playSound(wrongSound); // Play wrong answer sound
      setIsTimerActive(false);
      if (
        ownedPowerUps["Second Chance"] > 0 &&
        powerUpUsage["Second Chance"] < powerUpLimits["Second Chance"] &&
        !isSecondChance
      ) {
        toast((t) => (
          <div>
            <p className="text-white mb-2">Wrong answer! Use Second Chance PowerUp to retry?</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  triggerPowerUp("Second Chance");
                  setPowerUpUsage((prev) => ({
                    ...prev,
                    "Second Chance": prev["Second Chance"] + 1,
                  }));
                  setIsSecondChance(true);
                  setAnswerStatus(null);
                  setSelectedOption(null);
                  setIsTimerActive(true); // Resume the timer
                  toast.dismiss(t);
                  toast("Second Chance activated! Try again.", {
                    icon: <FaInfoCircle style={{ color: "#FFC107" }} />,
                    style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
                  });
                }}
                className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded"
              >
                Yes, Retry
              </button>
              <button
                onClick={() => {
                  setAnswerStatus("wrong");
                  resetStreak(); // Reset the streak when the user cancels
                  toast.dismiss(t);
                }}
                className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ), {
          style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
        });
        return;
      }
      setAnswerStatus("wrong");
      resetStreak();
    }
  };

  const handleUsePowerUp = (powerUpName) => {
    if (ownedPowerUps[powerUpName] > 0) {
      playSound(powerupSound); // Play power-up sound
      if (powerUpUsage[powerUpName] >= powerUpLimits[powerUpName]) {
        toast.error(`You reached the limit for ${powerUpName}.`, {
          style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
        });
        return;
      }
  
      triggerPowerUp(powerUpName);
      setPowerUpUsage((prev) => ({
        ...prev,
        [powerUpName]: prev[powerUpName] + 1,
      }));
  
      if (powerUpName === "Skip Question") {
        setScore(score + 1);
        setAnswerStatus("skipped");
        handleNext();
      } else if (powerUpName === "Extra Time") {
        setTimeLeft((prev) => prev + 10);
      }
  
      // Resume the timer after using a power-up
      setIsTimerActive(true);
  
      toast.success(`${powerUpName} PowerUp used!`, {
        style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
      });
    } else {
      toast.error(`You don't have any ${powerUpName} left!`, {
        style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
      });
    }
  };

  // ✅ Intro Screen
  if (!quizStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white text-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-bold mb-6"
        >
          Welcome to the Daily Crypto Quiz ⚡
        </motion.h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setQuizStarted(true)}
          className="bg-yellow-400 text-black px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-yellow-300 transition"
        >
          Start Quiz
        </motion.button>
      </div>
    );
  }

  if (quizFinished) {
    return (
      
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212] text-white text-center px-4">
<Lottie
  lottieRef={animationRef}
  animationData={quizCompleteAnimation}
  loop={false} // Ensure the animation does not loop
  autoplay={true} // Play the animation automatically
  className="w-72 h-72 mb-6"
  onComplete={() => {
    if (animationRef.current) {
      animationRef.current.goToAndStop(114, true); // Freeze on the last frame (frame 115 is 0-indexed)
    }
  }}
/>


        <h1 className="text-4xl font-bold mb-2">🎉 Quiz Completed!</h1>
        <p className="text-2xl mb-1">✅ Score: {score} / {quizData.length}</p>
        <p className="text-2xl mb-6">🔥 Max Streak: {maxStreak}</p>
        <button
          onClick={() => navigate("/")}
          className="bg-yellow-400 text-black px-6 py-3 rounded-2xl hover:bg-yellow-300 transition"
        >
          Back to Home
        </button>
      </div>
    );
  }
  

  const question = quizData[currentQuestion];

  return (
    <div className="flex flex-col md:flex-row max-w-6xl mx-auto p-4 gap-6 text-white">

      {/* Left Section */}
      <div className="flex-1 backdrop-blur-md bg-[#1F1F1F]/90 p-6 rounded-xl shadow-lg relative">

        {/* ✅ Timer Progress Bar */}
        <motion.div
  initial={{ width: "100%" }}
  animate={{ width: `${Math.min((timeLeft / 30) * 100, 100)}%` }} // Cap width at 100%
  transition={{ duration: 1, ease: "linear" }}
  className="h-2 rounded-full bg-yellow-400 absolute top-0 left-0"
/>

        {/* Top Section */}
        <div className="flex flex-col md:flex-row justify-between mb-2 gap-3 mt-1">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">⏱️ Time Left: {timeLeft}s</h2>
            <h2 className="text-lg md:text-xl font-semibold">🎯 Score: {score}</h2>
          </div>
          <div className="flex items-center gap-2">
          <motion.span
  animate={showFireAnimation ? { scale: [1, 1.5, 1], opacity: [1, 0.8, 1] } : {}}
  transition={{ duration: 0.6, ease: "easeInOut" }}
  className={`text-2xl ${streak % 5 === 0 ? "drop-shadow-glow text-yellow-400" : ""}`}
>
  🔥
</motion.span>

            <h2 className={`text-lg md:text-xl font-semibold ${streak > 0 && streak % 5 === 0 ? "text-yellow-400" : ""}`}>
              Streak: {streak}
            </h2>
          </div>
        </div>

        {/* Question & Options */}
<motion.div
  key={currentQuestion}
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.4 }}
>
  <h3 className="text-2xl font-bold mb-4">{question.question}</h3>
  <div className="grid gap-4">
    {question.options.map((option, idx) => (
      <motion.button
        key={idx}
        onClick={() => setSelectedOption(option)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className={`px-4 py-3 rounded-xl text-left transition ${
          selectedOption === option
            ? answerStatus === "correct"
              ? "bg-green-500 text-black"
              : answerStatus === "wrong"
              ? "bg-red-500 text-black"
              : "bg-yellow-400 text-black"
            : answerStatus === "wrong" && option === question.correctAnswer
            ? "bg-green-500 text-black"
            : answerStatus === "time-up" && option === question.correctAnswer // Highlight correct answer on time-up
            ? "bg-green-500 text-black"
            : "bg-[#333] hover:bg-yellow-500 hover:text-black"
        }`}
        disabled={answerStatus !== null}
      >
        {option}
      </motion.button>
    ))}
  </div>
</motion.div>


        {/* Footer Actions */}  
        <div className="flex gap-4 mt-8 flex-wrap">
          <button
            onClick={handleConfirmAnswer}
            disabled={!selectedOption || answerStatus !== null}
            className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-2xl transition disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={handleNext}
            disabled={answerStatus === null}
            className={`${
              currentQuestion + 1 === quizData.length
                ? "bg-red-500 hover:bg-red-400"
                : "bg-blue-500 hover:bg-blue-400"
            } text-white px-6 py-3 rounded-2xl transition disabled:opacity-50`}
          >
            {currentQuestion + 1 === quizData.length ? "Finish" : "Next"}
          </button>
        </div>

        {answerStatus === "time-up" && (
          <p className="text-red-500 mt-4 font-bold">⏰ Time's up!</p>
        )}
      </div>

{/* 🌟 Mobile-Only Sticky Power-Up Bar */}
<motion.div
  initial={{ y: 100, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
  className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#121212] border-t border-yellow-500 shadow-[0_-2px_10px_rgba(255,255,255,0.05)] backdrop-blur-md"
>
  <div className="flex justify-around items-center py-2 px-3 gap-2">
    {powerUpsConfig.map(({ name, label, icon, limit }) => {
      const isDisabled = ownedPowerUps[name] <= 0 || powerUpUsage[name] >= limit;

      return (
        <div key={name} className="group flex flex-col items-center gap-1 px-2 active:scale-95 transition">
          <button
            onClick={() => {
              if (isDisabled) {
                // Show appropriate reason for the button being disabled
                if (ownedPowerUps[name] <= 0) {
                  toast.error(`No ${name} power-ups available.`, {
                    style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
                  });
                } else if (powerUpUsage[name] >= limit) {
                  toast.error(`Usage limit for ${name} has been reached.`, {
                    style: { background: "#1F1F1F", color: "#fff", border: "1px solid #333", borderRadius: "12px" },
                  });
                }
              } else {
                handleUsePowerUp(name); // Use the power-up if not disabled
              }
            }}
            className={`p-3 rounded-full shadow-md transition ${
              isDisabled
                ? "bg-gray-500 cursor-pointer" // Allow clicks on greyed-out buttons
                : "bg-yellow-400 group-hover:bg-yellow-300"
            }`}
          >
            {icon}
          </button>
          <span
            className={`text-[11px] font-medium ${
              isDisabled ? "text-gray-400 opacity-50" : "text-white opacity-90 group-hover:opacity-100"
            }`}
          >
            {label}
          </span>
        </div>
      );
    })}
  </div>
</motion.div>

      {/* Right Section: PowerUps */}
      <div className="w-full md:w-1/3 bg-[#1F1F1F] p-6 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-yellow-400">⚡ Power-Ups</h2>
        <div className="flex flex-col gap-6">
        {powerUpsConfig.map(({ name, description, limit }) => (
  <div key={name} className="flex justify-between items-center bg-[#2A2A2A] p-4 rounded-xl">
    <div>
      <h4 className="font-semibold">{name}</h4>
      <p className="text-sm text-gray-400">
        {powerUpUsage[name]} / {limit} (Total: {ownedPowerUps[name] || 0})
      </p>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
    <button
      disabled={
        ownedPowerUps[name] <= 0 || powerUpUsage[name] >= limit
      }
      onClick={() => handleUsePowerUp(name)}
      className={`px-4 py-2 rounded-xl text-black font-bold transition ${
        ownedPowerUps[name] > 0 && powerUpUsage[name] < limit
          ? "bg-yellow-400 hover:bg-yellow-300"
          : "bg-gray-500 cursor-not-allowed"
      }`}
    >
      Use
    </button>
  </div>
))}
        </div>

        <button
          onClick={() => navigate("/store")}
          className="mt-8 w-full bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-2xl transition"
        >
          Go to Power-Ups Store
        </button>
      </div>
    </div>
  );
};

export default Quiz;

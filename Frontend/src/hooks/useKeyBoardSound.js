import { useEffect, useRef } from "react";

function useKeyBoardSound() {
  const soundsRef = useRef([]);

  useEffect(() => {
    soundsRef.current = [
      new Audio("/sounds/keystroke1.mp3"),
      new Audio("/sounds/keystroke2.mp3"),
      new Audio("/sounds/keystroke3.mp3"),
      new Audio("/sounds/keystroke4.mp3"),
    ];
  }, []);

  const playRandomKeyStrokeSound = () => {
    const sounds = soundsRef.current;
    if (!sounds.length) return;

    const sound = sounds[Math.floor(Math.random() * sounds.length)];
    sound.currentTime = 0;
    sound.play().catch(console.error);
  };

  return { playRandomKeyStrokeSound };
}

export default useKeyBoardSound;

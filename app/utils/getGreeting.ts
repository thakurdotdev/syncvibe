export function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 23 || hour < 5) {
    const lateNightMessages = [
      'Still debugging at this hour? Respect. 🌙',
      "console.log('Why am I still awake?'); 💤",
      "When your code runs at 3 AM but you don't know why. 🔥",
      "Git commit -m 'fixed bugs and created new ones' 🐛",
      'while(awake) { listenToMusic(); } 🎧',
      '404: Sleep not found. 💻',
    ];
    return lateNightMessages[Math.floor(Math.random() * lateNightMessages.length)];
  }

  if (hour < 12) {
    const morningMessages = [
      'Morning! Time to turn coffee into code. ☕',
      "System.out.println('Good Morning!'); ☀️",
      'import java.util.Coffee; // Required to function 🧠',
      'if(coffee > 0) { startCoding(); } else { getCoffee(); } ☕',
      'Ah, nothing like the smell of semicolons in the morning. 💻',
      'class Morning extends Pain implements Suffering {}',
    ];
    return morningMessages[Math.floor(Math.random() * morningMessages.length)];
  }

  if (hour < 18) {
    const afternoonMessages = [
      'Stack overflow: too many meetings, not enough code. 📈',
      "function afternoon() { return 'Why am I so tired?'; } 😴",
      'Your code is running but so is your deadline. ⏱️',
      "const mood = ['focused', 'caffeinated', 'confused']; 🧠",
      'try { beProductive(); } catch(e) { listenToMusic(); } 🎵',
      'Afternoon.js has stopped working. 💻',
    ];
    return afternoonMessages[Math.floor(Math.random() * afternoonMessages.length)];
  }

  if (hour < 21) {
    const eveningMessages = [
      "git commit -m 'Finally fixed that bug from this morning' 🐞",
      'select * from music where stress > productivity; 🎧',
      'Time to push your code and your limits. 💪',
      "console.log('End of day brain: null'); 🧠",
      'for(let hour = 5; hour < 9; hour++) { relaxMode = true; } 🌇',
      'while(true) { if(dayEnded) break; else panic(); } 😅',
    ];
    return eveningMessages[Math.floor(Math.random() * eveningMessages.length)];
  }

  const nightMessages = [
    "if(brain === 'fried') { return music.play(); } 🧠",
    "TypeError: Cannot read property 'energy' of null 🔋",
    'async function sleep() { // Promise never resolves 😴',
    "switch(mood) { case 'tired': return music.volume(100); } 🎵",
    'let tomorrow = new Promise((resolve) => setTimeout(resolve, 8 * 3600000)); 🌙',
    'sudo apt-get install motivation 💻',
  ];
  return nightMessages[Math.floor(Math.random() * nightMessages.length)];
}

let notificationAudio: HTMLAudioElement | null = null;

export function enableNotificationSound() {
  notificationAudio = new Audio(
    '/sounds/mixkit-confirmation-tone-2867.wav',
  );
  notificationAudio.volume = 0.5;
  notificationAudio.load();
}



export function enableTypingNotificationSound() {
  notificationAudio = new Audio(
    'sounds/mixkit-keyboard-typing-1386.wav',
  );

  notificationAudio.volume = 0.5;
  notificationAudio.load();
  notificationAudio.loop = true
}



export async function playNotificationSound() {
  if (!notificationAudio) {
    enableNotificationSound();
  }

  if (!notificationAudio) return;

  try {
    notificationAudio.currentTime = 0;
    await notificationAudio.play();
  } catch (error) {
    console.warn('Notification sound could not play:', error);
  }
}

export async function playTyping() {
  if (!notificationAudio) {
    enableTypingNotificationSound();
  }

  if (!notificationAudio) return;

  try {
    notificationAudio.currentTime = 0;
    await notificationAudio.play();
  } catch (error) {
    console.warn('Notification sound could not play:', error);
  }
}
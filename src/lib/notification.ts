import notificationSrc from '../assets/notification.wav'

const notificationAudio = new Audio(notificationSrc)

export function playNotificationSound() {
  notificationAudio.currentTime = 0
  notificationAudio.play().catch(err => console.warn('Notification sound blocked:', err))
}

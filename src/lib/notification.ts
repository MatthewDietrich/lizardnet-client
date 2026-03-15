import atonalSrc from '../assets/notification_atonal.wav'
import tonalSrc from '../assets/notification_tonal.wav'

const sounds = {
  atonal: new Audio(atonalSrc),
  tonal: new Audio(tonalSrc),
}

export function playNotificationSound(type: 'atonal' | 'tonal' = 'atonal') {
  const audio = sounds[type]
  audio.currentTime = 0
  audio.play().catch(err => console.warn('Notification sound blocked:', err))
}

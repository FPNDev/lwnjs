const time = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});
const day = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

/** "14:05" today, "Mar 3" before. */
export function formatTime(at: number) {
  const date = new Date(at);

  return date.toDateString() === new Date().toDateString()
    ? time.format(date)
    : day.format(date);
}

export function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

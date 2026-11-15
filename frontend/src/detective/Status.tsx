import { API } from '../lib/api'

export function Loading({ what }: { what: string }) {
  return <p className="py-16 text-center text-ink-2">Loading {what}…</p>
}

export function Failed({ message }: { message: string }) {
  const unreachable = message.startsWith('Could not reach')
  return (
    <div className="my-8 max-w-xl border-l-4 border-r-vhigh bg-paper-2 p-4">
      <p className="font-medium">{message}</p>
      {unreachable && (
        <p className="mt-2 text-sm text-ink-2">
          Start the backend from the <code className="num rounded bg-paper px-1">backend</code> folder with
          <code className="num mx-1 rounded bg-paper px-1">uvicorn app.main:app --port 8000</code>
          or point <code className="num rounded bg-paper px-1">VITE_API_URL</code> at it (now {API}). The first request for each lake downloads its NASA POWER record, which can take a minute.
        </p>
      )}
    </div>
  )
}

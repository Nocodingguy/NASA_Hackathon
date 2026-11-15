import { API } from '../lib/api'

export function Loading({ what }: { what: string }) {
  return <p className="animate-pulse py-20 text-center text-sm tracking-wide text-ink-2">Loading {what}</p>
}

export function Failed({ message }: { message: string }) {
  const unreachable = message.startsWith('Could not reach')
  return (
    <div className="my-8 max-w-xl rounded-lg border border-r-vhigh/30 border-l-2 border-l-r-vhigh bg-paper-2/70 p-5">
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

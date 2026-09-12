import { useCallback, useEffect, useState } from 'react'

/** Ignore responses from previous routes/filters, including React StrictMode remounts. */
export function useAsyncResource(fetcher) {
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setState({ loading: true, data: null, error: null, fetcher, revision })
    Promise.resolve().then(fetcher).then(data => {
      if (active) setState({ loading: false, data, error: null, fetcher, revision })
    }, error => {
      if (active) setState({ loading: false, data: null, error, fetcher, revision })
    })
    return () => { active = false }
  }, [fetcher, revision])
  const reload = useCallback(() => setRevision(value => value + 1), [])
  // Do not expose the previous route's data during the render before its effect runs.
  return state.fetcher === fetcher && state.revision === revision ? { ...state, reload } : { loading: true, data: null, error: null, reload }
}

import { Link } from 'react-router-dom'
import { Empty } from '../components/ui'

export default function NotFound({ denied }) {
  return (
    <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
      <Empty icon={denied ? 'ti-lock' : 'ti-map-question'} title={denied ? 'You do not have access to this page' : 'Page not found'}>
        <p>{denied ? 'Ask your administrator if you need this permission.' : 'The page you opened does not exist.'}</p>
        <Link className="btn primary" to="/">Go to home</Link>
      </Empty>
    </div>
  )
}

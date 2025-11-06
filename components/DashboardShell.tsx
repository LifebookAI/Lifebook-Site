type Props = { children: React.ReactNode };
export default function DashboardShell({ children }: Props) {
  return (
    <div className='card'>
      <h2 style={{marginTop:0}}>Dashboard</h2>
      <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:'1rem'}}>
        <aside className='card' style={{padding:'.75rem'}}>
          <ul style={{listStyle:'none',padding:0,margin:0}}>
            <li><a href='/dashboard'>Overview</a></li>
            <li><a href='#'>Uploads</a></li>
            <li><a href='#'>Summaries</a></li>
            <li><a href='#'>Exports</a></li>
            <li><a href='#'>Settings</a></li>
          </ul>
        </aside>
        <section className='card'>{children}</section>
      </div>
    </div>
  );
}

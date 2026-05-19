import { useAuth } from '../lib/auth.jsx';

export default function ReviewPendingScreen() {
  const { signOut } = useAuth();
  return (
    <div className="px-7 pt-16 pb-10 flex-1 flex flex-col items-center text-center">
      <h1 className="font-display rose text-[22px] tracking-[0.32em] mb-10"
        style={{ fontWeight: 400 }}>MAISON</h1>
      <h2 className="font-display ink text-[24px] leading-tight italic mb-4" style={{ fontWeight: 400 }}>
        Your access request is being reviewed.
      </h2>
      <p className="font-display ink text-[15px] leading-relaxed mb-10" style={{ maxWidth: '320px' }}>
        We read each one personally. Most replies come within a few days. Thank you for your patience.
      </p>
      <button onClick={signOut}
        className="muted text-[12px] font-body italic font-display nav-btn">
        Sign out
      </button>
    </div>
  );
}

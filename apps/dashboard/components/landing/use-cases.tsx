const useCases = [
  {
    title: 'Conference and event discovery',
    description:
      'Help visitors browse upcoming conferences, services, or event details from live API data with clickable links to each item.',
  },
  {
    title: 'Account and support operations',
    description:
      'Guide customers through account questions, order issues, profile updates, or support triage with better context.',
  },
  {
    title: 'Sales and lead capture',
    description:
      'Recommend the right products or services, answer buying questions, and capture follow-up details for sales teams.',
  },
  {
    title: 'Human escalation for exceptions',
    description:
      'When a conversation needs manual care, the platform makes the handoff visible and keeps the thread intact.',
  },
];

export function LandingUseCases() {
  return (
    <section className="border-t border-white/5 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Use cases</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Practical workflows visitors and teams can understand immediately.
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-400 sm:text-lg">
            This platform is especially useful when your customers need more than a static answer and your team
            needs more than a black-box chatbot.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {useCases.map((item) => (
            <div
              key={item.title}
              className="rounded-[28px] border border-white/5 bg-slate-900/45 p-6 sm:p-8"
            >
              <h3 className="text-xl font-semibold text-slate-50">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
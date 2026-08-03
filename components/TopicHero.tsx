type TopicMetric = {
  value: string | number;
  label: string;
};

type TopicHeroProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  description: string;
  metrics: TopicMetric[];
};

export function TopicHero({ eyebrow, title, subtitle, description, metrics }: TopicHeroProps) {
  return (
    <header className="topic-hero">
      <div className="topic-hero-copy">
        <span>{eyebrow}</span>
        <h1>{title}{subtitle ? <small>（{subtitle}）</small> : null}</h1>
        <p>{description}</p>
      </div>
      <dl>
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.value}</dt>
            <dd>{metric.label}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

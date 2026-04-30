interface Props {
  channelName: string;
}

export default function VoicePlaceholder({ channelName }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-ink-tertiary gap-3 px-6 text-center">
      <div className="text-5xl">🔊</div>
      <h2 className="text-xl text-ink-primary font-semibold">Голосовой канал: {channelName}</h2>
      <p className="max-w-md text-sm">
        Голос и видео появятся в фазе&nbsp;2 (mediasoup&nbsp;SFU). Инфраструктура (coturn,
        mediasoup workers) уже подключена в <code>docker-compose.yml</code>; клиентский
        join/produce/consume будет в следующем релизе.
      </p>
    </div>
  );
}

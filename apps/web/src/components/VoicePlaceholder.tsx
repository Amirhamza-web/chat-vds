interface Props {
  channelName: string;
}

export default function VoicePlaceholder({ channelName }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3 px-6 text-center">
      <div className="text-5xl">🔊</div>
      <h2 className="text-xl text-white font-semibold">Voice channel: {channelName}</h2>
      <p className="max-w-md text-sm">
        Voice/video chat is part of Phase 2 (mediasoup SFU). The infrastructure (coturn,
        mediasoup workers) is already wired up in <code>docker-compose.yml</code>; the client
        join/produce/consume flow ships in the next release.
      </p>
    </div>
  );
}

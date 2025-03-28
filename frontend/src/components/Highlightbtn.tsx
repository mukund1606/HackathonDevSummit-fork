import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function HighlightButton() {
  const router = useRouter();

  const handleNavigateToWebRTC = () => {
    // Using the new navigation system
    router.push("/webrtc");
  };
  return (
    <button onClick={handleNavigateToWebRTC} className="flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500 text-blue-500 font-medium transition-all hover:bg-blue-100 dark:hover:bg-blue-900">
      <Sparkles className="w-4 h-4 text-blue-500" />
      <span>AI-to-AI Dialogue Protocol</span>
    </button>
  );
}

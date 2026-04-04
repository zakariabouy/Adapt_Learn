import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-b from-indigo-500 to-purple-600 text-white">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex absolute top-10 px-10">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          AdaptLearn Phase 1 &nbsp;
          <code className="font-bold">Next.js + FastAPI</code>
        </p>
      </div>

      <div className="text-center">
        <h1 className="text-6xl font-extrabold mb-4 tracking-tight">
          AdaptLearn
        </h1>
        <p className="text-xl mb-8 opacity-90 max-w-md mx-auto">
          AI-powered inclusive education platform for students with dyslexia, ADHD, and other disabilities.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link 
            href="/auth/login" 
            className="px-8 py-3 bg-white text-indigo-600 rounded-full font-bold text-lg hover:bg-opacity-90 transition transform hover:scale-105"
          >
            Login
          </Link>
          <Link 
            href="/auth/register" 
            className="px-8 py-3 border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white hover:text-indigo-600 transition transform hover:scale-105"
          >
            Register
          </Link>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
        <div className="bg-white bg-opacity-10 p-6 rounded-2xl backdrop-blur-sm">
          <h3 className="text-xl font-bold mb-2">Multimodal Adaptation</h3>
          <p className="text-sm opacity-80">Content automatically adapts to text, audio, or visual modalities.</p>
        </div>
        <div className="bg-white bg-opacity-10 p-6 rounded-2xl backdrop-blur-sm">
          <h3 className="text-xl font-bold mb-2">Real-time Telemetry</h3>
          <p className="text-sm opacity-80">AI monitors engagement and frustration to adjust difficulty.</p>
        </div>
        <div className="bg-white bg-opacity-10 p-6 rounded-2xl backdrop-blur-sm">
          <h3 className="text-xl font-bold mb-2">Personalized IEPs</h3>
          <p className="text-sm opacity-80">Generates Individualized Education Programs autonomously.</p>
        </div>
      </div>
    </main>
  );
}

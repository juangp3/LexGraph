import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24 bg-gray-900 text-white">
      <header className="w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          LexGraph
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <a
            className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
            href="https://github.com/juangp3/LexGraph"
            target="_blank"
            rel="noopener noreferrer"
          >
            By{" "}
            <Image
              src="/vercel.svg"
              alt="Vercel Logo"
              className="dark:invert"
              width={100}
              height={24}
              priority
            />
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-24">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">LexGraph</h1>
          <p className="text-lg text-muted-foreground">
            The etymological graph explorer.
          </p>
        </div>
      </main>

      <footer className="w-full max-w-5xl items-center justify-center font-mono text-sm lg:flex">
        <p>&copy; 2026 LexGraph. All rights reserved.</p>
      </footer>
    </div>
  );
}

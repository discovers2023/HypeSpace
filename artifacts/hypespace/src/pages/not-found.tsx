import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <h1 className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            404
          </h1>
          <h2 className="text-2xl font-semibold text-foreground">
            Looks like you've gone backstage
          </h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved. Let's get you back to the main event.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto">
                Go Home
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent border-0">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

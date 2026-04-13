import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Venues from "./pages/Venues";
import CreateConcert from "./pages/CreateConcert";
import Library from "./pages/Library";
import PresetLibrary from "./pages/PresetLibrary";
import ConcertTicket from "./pages/ConcertTicket";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/venues"} component={Venues} />
      <Route path={"/create"} component={CreateConcert} />
      <Route path={"/create/:venueSlug"} component={CreateConcert} />
      <Route path={"/library"} component={Library} />
      <Route path={"/presets"} component={PresetLibrary} />
      <Route path={"/concert/:slug"} component={ConcertTicket} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

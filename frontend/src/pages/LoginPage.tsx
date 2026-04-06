import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async () => {
    try {
      setError("");
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate("/");
    } catch {
      setError("Authentication failed. Check credentials and try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
        <h1 className="mb-1 text-2xl font-bold">Expense Manager</h1>
        <p className="mb-4 text-sm text-muted-foreground">Track your expenses across all accounts.</p>

        {mode === "register" && (
          <div className="mb-3">
            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="mb-3">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-4">
          <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error ? <p className="mb-3 text-sm text-foreground">{error}</p> : null}

        <Button className="w-full" type="submit">
          {mode === "login" ? "Login" : "Create Account"}
        </Button>
        <button
          type="button"
          className="mt-3 w-full text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Login"}
        </button>
        </form>
      </Card>
    </div>
  );
}

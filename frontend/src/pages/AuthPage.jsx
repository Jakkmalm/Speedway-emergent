// src/pages/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast"   // eller "@/components/ui/use-toast"
import { toast } from "sonner"; // Använd sonner för toast
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const redirectTo = decodeURIComponent(sp.get("redirectTo") || "/");

  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
  });


  // Om man redan är inloggad och går till /auth → hoppa vidare direkt
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, redirectTo, navigate]);

  const doLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(loginForm.username, loginForm.password);
      navigate(redirectTo, { replace: true });
      // Om du vill – visa en positiv toast:
      toast.success("Välkommen tillbaka!");
    } catch (err) {
      // Visa *användarvänligt* fel
      toast.error("Inloggning misslyckades", {
        description: err?.message || "Något gick fel. Försök igen.",
      });
      // Extra: logga detaljerat fel till konsolen
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(
        registerForm.username,
        registerForm.email,
        registerForm.password
      );
      navigate(redirectTo, { replace: true });
      toast.success("Konto skapat!");
    } catch (err) {
      toast.error("Registrering misslyckades", {
        description: err?.message || "Något gick fel. Försök igen.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm bg-background shadow rounded-xl p-6">
        <h1 className="text-xl font-semibold mb-2 text-center">Välkommen</h1>
        <p className="text-sm text-gray-600 text-center mb-4">
          Logga in eller skapa konto
        </p>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Logga in</TabsTrigger>
            <TabsTrigger value="register">Registrera</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={doLogin} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="username">Användarnamn</Label>
                <Input
                  id="username"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Lösenord</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Loggar in..." : "Logga in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={doRegister} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="reg-username">Användarnamn</Label>
                <Input
                  id="reg-username"
                  value={registerForm.username}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      username: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="reg-password">Lösenord</Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      password: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Skapar konto..." : "Skapa konto"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

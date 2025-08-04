import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Trophy, Users, Calendar, Target, CheckCircle, Clock, Play } from 'lucide-react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [heats, setHeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('seriespel');

  // Auth forms
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  // Match creation
  const [matchForm, setMatchForm] = useState({
    home_team_id: '',
    away_team_id: '',
    date: '',
    venue: ''
  });

  // Heat management
  const [heatForm, setHeatForm] = useState({
    heat_number: 1,
    drivers: [
      { name: '', team: '', gate: 1 },
      { name: '', team: '', gate: 2 },
      { name: '', team: '', gate: 3 },
      { name: '', team: '', gate: 4 }
    ]
  });

  // Load data on mount
  useEffect(() => {
    loadTeams();
    loadMatches();
    
    // Check for stored auth token
    const token = localStorage.getItem('speedway_token');
    const userData = localStorage.getItem('speedway_user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('speedway_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'API Error');
    }

    return response.json();
  };

  const loadTeams = async () => {
    try {
      const data = await apiCall('/api/teams');
      setTeams(data);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadMatches = async () => {
    try {
      const data = await apiCall('/api/matches');
      setMatches(data);
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiCall('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm)
      });

      localStorage.setItem('speedway_token', response.token);
      localStorage.setItem('speedway_user', JSON.stringify(response.user));
      setUser(response.user);
      setShowAuthDialog(false);
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      alert('Inloggning misslyckades: ' + error.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiCall('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm)
      });

      localStorage.setItem('speedway_token', response.token);
      localStorage.setItem('speedway_user', JSON.stringify(response.user));
      setUser(response.user);
      setShowAuthDialog(false);
      setRegisterForm({ username: '', email: '', password: '' });
    } catch (error) {
      alert('Registrering misslyckades: ' + error.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('speedway_token');
    localStorage.removeItem('speedway_user');
    setUser(null);
    setCurrentMatch(null);
  };

  const createMatch = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Du måste vara inloggad för att skapa matcher');
      return;
    }

    setLoading(true);
    try {
      await apiCall('/api/matches', {
        method: 'POST',
        body: JSON.stringify(matchForm)
      });

      alert('Match skapad!');
      setMatchForm({ home_team_id: '', away_team_id: '', date: '', venue: '' });
      loadMatches();
    } catch (error) {
      alert('Kunde inte skapa match: ' + error.message);
    }
    setLoading(false);
  };

  const startMatch = async (matchId) => {
    try {
      const matchData = await apiCall(`/api/matches/${matchId}`);
      setCurrentMatch(matchData);
      setActiveTab('protokoll');
    } catch (error) {
      alert('Kunde inte ladda match: ' + error.message);
    }
  };

  const createHeat = async () => {
    if (!currentMatch) return;

    setLoading(true);
    try {
      await apiCall(`/api/matches/${currentMatch.id}/heats`, {
        method: 'POST',
        body: JSON.stringify(heatForm)
      });

      alert('Heat skapat!');
      setHeatForm({
        heat_number: heatForm.heat_number + 1,
        drivers: [
          { name: '', team: '', gate: 1 },
          { name: '', team: '', gate: 2 },
          { name: '', team: '', gate: 3 },
          { name: '', team: '', gate: 4 }
        ]
      });

      // Reload match data
      const matchData = await apiCall(`/api/matches/${currentMatch.id}`);
      setCurrentMatch(matchData);
    } catch (error) {
      alert('Kunde inte skapa heat: ' + error.message);
    }
    setLoading(false);
  };

  const updateDriverField = (index, field, value) => {
    const newDrivers = [...heatForm.drivers];
    newDrivers[index][field] = value;
    setHeatForm({ ...heatForm, drivers: newDrivers });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b-4 border-red-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Speedway Elitserien</h1>
                <p className="text-gray-600">Digital Matchprotokoll</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">Hej, {user.username}!</span>
                  <Button onClick={handleLogout} variant="outline">
                    Logga ut
                  </Button>
                </div>
              ) : (
                <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-red-600 hover:bg-red-700">
                      Logga in
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {authMode === 'login' ? 'Logga in' : 'Skapa konto'}
                      </DialogTitle>
                      <DialogDescription>
                        {authMode === 'login' 
                          ? 'Logga in för att föra matchprotokoll'
                          : 'Skapa ett nytt konto för att komma igång'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs value={authMode} onValueChange={setAuthMode}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Logga in</TabsTrigger>
                        <TabsTrigger value="register">Registrera</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="login">
                        <form onSubmit={handleLogin} className="space-y-4 mt-4">
                          <div>
                            <Label htmlFor="username">Användarnamn</Label>
                            <Input
                              id="username"
                              value={loginForm.username}
                              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="password">Lösenord</Label>
                            <Input
                              id="password"
                              type="password"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
                            {loading ? 'Loggar in...' : 'Logga in'}
                          </Button>
                        </form>
                      </TabsContent>
                      
                      <TabsContent value="register">
                        <form onSubmit={handleRegister} className="space-y-4 mt-4">
                          <div>
                            <Label htmlFor="reg-username">Användarnamn</Label>
                            <Input
                              id="reg-username"
                              value={registerForm.username}
                              onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">E-post</Label>
                            <Input
                              id="email"
                              type="email"
                              value={registerForm.email}
                              onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="reg-password">Lösenord</Label>
                            <Input
                              id="reg-password"
                              type="password"
                              value={registerForm.password}
                              onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                              required
                            />
                          </div>
                          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={loading}>
                            {loading ? 'Skapar konto...' : 'Skapa konto'}
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="seriespel">
              <Trophy className="w-4 h-4 mr-2" />
              Seriespel
            </TabsTrigger>
            <TabsTrigger value="matcher">
              <Calendar className="w-4 h-4 mr-2" />
              Matcher
            </TabsTrigger>
            <TabsTrigger value="protokoll">
              <Target className="w-4 h-4 mr-2" />
              Matchprotokoll
            </TabsTrigger>
          </TabsList>

          {/* League Standings */}
          <TabsContent value="seriespel">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                  Elitserien Tabell
                </CardTitle>
                <CardDescription>
                  Aktuell ställning i Speedway Elitserien
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Pos</th>
                        <th className="text-left py-3 px-4">Lag</th>
                        <th className="text-left py-3 px-4">Stad</th>
                        <th className="text-right py-3 px-4">Matcher</th>
                        <th className="text-right py-3 px-4">Poäng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team, index) => (
                        <tr key={team.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">
                            {index + 1}
                            {index === 0 && <Trophy className="w-4 h-4 inline ml-2 text-yellow-600" />}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">{team.name}</td>
                          <td className="py-3 px-4 text-gray-600">{team.city}</td>
                          <td className="py-3 px-4 text-right">{team.matches_played}</td>
                          <td className="py-3 px-4 text-right">
                            <Badge variant={index < 3 ? "default" : "secondary"}>
                              {team.points}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matcher">
            <div className="grid gap-6">
              {/* Create Match */}
              {user && (
                <Card>
                  <CardHeader>
                    <CardTitle>Skapa ny match</CardTitle>
                    <CardDescription>Lägg till en ny match i systemet</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={createMatch} className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="home-team">Hemmalag</Label>
                        <Select value={matchForm.home_team_id} onValueChange={(value) => setMatchForm({...matchForm, home_team_id: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj hemmalag" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map(team => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="away-team">Bortalag</Label>
                        <Select value={matchForm.away_team_id} onValueChange={(value) => setMatchForm({...matchForm, away_team_id: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj bortalag" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map(team => (
                              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="date">Datum & Tid</Label>
                        <Input
                          id="date"
                          type="datetime-local"
                          value={matchForm.date}
                          onChange={(e) => setMatchForm({...matchForm, date: e.target.value})}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="venue">Arena</Label>
                        <Input
                          id="venue"
                          value={matchForm.venue}
                          onChange={(e) => setMatchForm({...matchForm, venue: e.target.value})}
                          placeholder="Ange arena/bana"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button type="submit" className="bg-red-600 hover:bg-red-700" disabled={loading}>
                          {loading ? 'Skapar...' : 'Skapa match'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Match List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Kommande matcher
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {matches.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">Inga matcher inplanerade</p>
                    ) : (
                      matches.map(match => (
                        <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4">
                              <div className="text-lg font-semibold">
                                {match.home_team} vs {match.away_team}
                              </div>
                              <Badge variant={match.status === 'completed' ? 'default' : match.status === 'live' ? 'destructive' : 'secondary'}>
                                {match.status === 'completed' ? 'Avslutad' : match.status === 'live' ? 'Live' : 'Kommande'}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {formatDate(match.date)} • {match.venue}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {match.status === 'completed' && (
                              <div className="text-right">
                                <div className="text-lg font-bold">
                                  {match.home_score} - {match.away_score}
                                </div>
                              </div>
                            )}
                            {user && match.status === 'upcoming' && (
                              <Button onClick={() => startMatch(match.id)} size="sm">
                                <Play className="w-4 h-4 mr-2" />
                                Starta protokoll
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Match Protocol */}
          <TabsContent value="protokoll">
            {!currentMatch ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="w-16 h-16 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Inget matchprotokoll aktivt</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    Välj en match från fliken "Matcher" för att börja föra protokoll
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Match Header */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      {currentMatch.home_team} vs {currentMatch.away_team}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(currentMatch.date)} • {currentMatch.venue}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-8 text-center">
                      <div>
                        <div className="text-3xl font-bold text-red-600">{currentMatch.home_score}</div>
                        <div className="text-sm text-gray-600">{currentMatch.home_team}</div>
                      </div>
                      <div>
                        <div className="text-lg text-gray-400">-</div>
                        <Badge variant={currentMatch.status === 'live' ? 'destructive' : 'secondary'}>
                          {currentMatch.status === 'live' ? 'Pågår' : 'Kommande'}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-blue-600">{currentMatch.away_score}</div>
                        <div className="text-sm text-gray-600">{currentMatch.away_team}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Create Heat */}
                {user && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Skapa Heat {heatForm.heat_number}</CardTitle>
                      <CardDescription>Lägg till förare för nästa heat</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        {heatForm.drivers.map((driver, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center mb-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                                {driver.gate}
                              </div>
                              <Label className="font-semibold">Spår {driver.gate}</Label>
                            </div>
                            <div className="space-y-2">
                              <Input
                                placeholder="Förarens namn"
                                value={driver.name}
                                onChange={(e) => updateDriverField(index, 'name', e.target.value)}
                              />
                              <Input
                                placeholder="Lag"
                                value={driver.team}
                                onChange={(e) => updateDriverField(index, 'team', e.target.value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6">
                        <Button onClick={createHeat} className="bg-red-600 hover:bg-red-700" disabled={loading}>
                          {loading ? 'Skapar heat...' : 'Skapa heat'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Heats List */}
                {currentMatch.heats && currentMatch.heats.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Heat-resultat</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {currentMatch.heats.map(heat => (
                          <div key={heat.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-semibold">Heat {heat.heat_number}</h4>
                              <Badge variant={heat.status === 'completed' ? 'default' : 'secondary'}>
                                {heat.status === 'completed' ? (
                                  <><CheckCircle className="w-3 h-3 mr-1" /> Avslutad</>
                                ) : (
                                  <><Clock className="w-3 h-3 mr-1" /> Kommande</>
                                )}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-sm">
                              {heat.drivers.map((driver, index) => (
                                <div key={index} className="text-center p-2 bg-gray-50 rounded">
                                  <div className="font-medium">{driver.name || 'TBD'}</div>
                                  <div className="text-gray-600">{driver.team}</div>
                                  <div className="text-xs mt-1">Spår {driver.gate}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Trophy, Users, Calendar, Target, CheckCircle, Clock, Play, Star, Zap, AlertTriangle, Repeat, Edit, Save, X } from 'lucide-react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [user, setUser] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [userMatches, setUserMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);
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

  // Heat result form
  const [currentHeat, setCurrentHeat] = useState(null);
  const [editingHeat, setEditingHeat] = useState(null);
  const [heatResults, setHeatResults] = useState({});
  const [jokerRider, setJokerRider] = useState('');
  const [jokerTeam, setJokerTeam] = useState('');

  // Match confirmation
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadTeams();
    loadMatches();
    
    // Check for stored auth token
    const token = localStorage.getItem('speedway_token');
    const userData = localStorage.getItem('speedway_user');
    if (token && userData) {
      setUser(JSON.parse(userData));
      loadUserMatches();
    }
  }, []);

  // Load user matches when user logs in
  useEffect(() => {
    if (user) {
      loadUserMatches();
    }
  }, [user]);

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

  const loadUserMatches = async () => {
    try {
      const data = await apiCall('/api/user/matches');
      setUserMatches(data);
    } catch (error) {
      console.error('Error loading user matches:', error);
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
      loadUserMatches();
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
      loadUserMatches();
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
    setUserMatches([]);
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

      alert('Match skapad med förbestämda 15 heat!');
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

  const openHeatResult = (heat) => {
    setCurrentHeat(heat);
    setEditingHeat(null);
    initializeHeatForm(heat);
  };

  const editHeatResult = (heat) => {
    setEditingHeat(heat);
    setCurrentHeat(heat);
    initializeHeatForm(heat);
  };

  const initializeHeatForm = (heat) => {
    const initialResults = {};
    Object.keys(heat.riders).forEach(gate => {
      const rider = heat.riders[gate];
      const existingResult = heat.results?.find(r => r.rider_id === rider.rider_id);
      
      initialResults[rider.rider_id] = {
        position: existingResult?.position?.toString() || '',
        status: existingResult?.status || 'completed'
      };
    });
    setHeatResults(initialResults);
    
    // Set joker if exists
    const jokerResult = heat.results?.find(r => r.rider_id === heat.joker_rider);
    if (jokerResult) {
      setJokerRider(heat.joker_rider);
      const jokerRiderInfo = Object.values(heat.riders).find(r => r.rider_id === heat.joker_rider);
      setJokerTeam(jokerRiderInfo?.team || '');
    } else {
      setJokerRider('');
      setJokerTeam('');
    }
  };

  const updateHeatResult = (riderId, field, value) => {
    setHeatResults(prev => ({
      ...prev,
      [riderId]: {
        ...prev[riderId],
        [field]: value
      }
    }));
  };

  const submitHeatResult = async () => {
    if (!currentHeat || !currentMatch) return;

    setLoading(true);
    try {
      const results = Object.keys(heatResults).map(riderId => ({
        rider_id: riderId,
        position: parseInt(heatResults[riderId].position) || 0,
        status: heatResults[riderId].status
      }));

      const resultData = {
        results: results,
        joker_rider_id: jokerRider || null,
        joker_team: jokerTeam || null
      };

      await apiCall(`/api/matches/${currentMatch.id}/heat/${currentHeat.heat_number}/result`, {
        method: 'PUT',
        body: JSON.stringify(resultData)
      });

      // Reload match data
      const updatedMatch = await apiCall(`/api/matches/${currentMatch.id}`);
      setCurrentMatch(updatedMatch);
      setCurrentHeat(null);
      setEditingHeat(null);
      alert('Heat resultat sparat!');
    } catch (error) {
      alert('Kunde inte spara resultat: ' + error.message);
    }
    setLoading(false);
  };

  const confirmMatch = async () => {
    if (!currentMatch) return;

    setLoading(true);
    try {
      const response = await apiCall(`/api/matches/${currentMatch.id}/confirm`, {
        method: 'PUT'
      });

      setConfirmationResult(response);
      setShowConfirmDialog(true);
      loadUserMatches();
      
      // Update current match status
      const updatedMatch = await apiCall(`/api/matches/${currentMatch.id}`);
      setCurrentMatch(updatedMatch);
    } catch (error) {
      alert('Kunde inte bekräfta match: ' + error.message);
    }
    setLoading(false);
  };

  const resolveDiscrepancy = async (userMatchId, action) => {
    setLoading(true);
    try {
      await apiCall(`/api/user/matches/${userMatchId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ action })
      });

      loadUserMatches();
      alert('Konflikt löst!');
    } catch (error) {
      alert('Kunde inte lösa konflikt: ' + error.message);
    }
    setLoading(false);
  };

  const canUseJoker = (team) => {
    if (!currentMatch) return false;
    
    const scoreDiff = Math.abs(currentMatch.home_score - currentMatch.away_score);
    const isLosingTeam = team === 'home' ? 
      currentMatch.home_score < currentMatch.away_score : 
      currentMatch.away_score < currentMatch.home_score;
    
    const jokerUsed = team === 'home' ? currentMatch.joker_used_home : currentMatch.joker_used_away;
    
    return scoreDiff >= 6 && isLosingTeam && !jokerUsed;
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

  const getPositionColor = (position) => {
    switch(position) {
      case 1: return 'bg-yellow-500 text-black';
      case 2: return 'bg-gray-400 text-white';
      case 3: return 'bg-amber-600 text-white';
      case 4: return 'bg-gray-600 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'completed': return <Badge className="bg-green-600">Genomförd</Badge>;
      case 'excluded': return <Badge className="bg-red-600">Utesluten</Badge>;
      case 'upcoming': return <Badge variant="secondary">Kommande</Badge>;
      default: return <Badge variant="secondary">Okänd</Badge>;
    }
  };

  const getRiderGateStyle = (team, gate) => {
    // Home team: Red (gates 1,3), Blue (gates 2,4 when away)
    // Away team: Yellow (gates 2,4), White when visible
    if (team === 'home') {
      return gate === '1' || gate === '3' ? 'border-l-4 border-red-600 bg-red-50' : 'border-l-4 border-blue-600 bg-blue-50';
    } else {
      return gate === '2' || gate === '4' ? 'border-l-4 border-yellow-500 bg-yellow-50' : 'border-l-4 border-gray-300 bg-gray-50';
    }
  };

  const completedHeats = currentMatch ? currentMatch.heats?.filter(h => h.status === 'completed').length || 0 : 0;
  const canConfirmMatch = completedHeats === 15;

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
                <p className="text-gray-600">Professionellt Matchprotokoll</p>
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
          <TabsList className="grid w-full grid-cols-4 mb-8">
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
            {user && (
              <TabsTrigger value="mina-matcher">
                <Users className="w-4 h-4 mr-2" />
                Mina matcher
              </TabsTrigger>
            )}
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
                    <CardDescription>Lägg till en ny match med förbestämda 15 heat</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={createMatch} className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="home-team">Hemmalag (Röd/Blå)</Label>
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
                        <Label htmlFor="away-team">Bortalag (Gul/Vit)</Label>
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
                          {loading ? 'Skapar...' : 'Skapa match med 15 heat'}
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
                    Matcher
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
                              <Badge variant={
                                match.status === 'confirmed' ? 'default' :
                                match.status === 'completed' ? 'secondary' : 
                                match.status === 'live' ? 'destructive' : 'secondary'
                              }>
                                {match.status === 'confirmed' ? 'Bekräftad' :
                                 match.status === 'completed' ? 'Avslutad' : 
                                 match.status === 'live' ? 'Live' : 'Kommande'}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {formatDate(match.date)} • {match.venue}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            {(match.status === 'completed' || match.status === 'confirmed') && (
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
                    <CardTitle className="text-2xl flex items-center justify-between">
                      <span>{currentMatch.home_team} vs {currentMatch.away_team}</span>
                      {user && canConfirmMatch && currentMatch.status !== 'confirmed' && (
                        <Button onClick={confirmMatch} className="bg-green-600 hover:bg-green-700" disabled={loading}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {loading ? 'Bekräftar...' : 'Bekräfta match'}
                        </Button>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(currentMatch.date)} • {currentMatch.venue} • {completedHeats}/15 Heat komplett
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-8 text-center">
                      <div>
                        <div className="text-4xl font-bold text-red-600">{currentMatch.home_score}</div>
                        <div className="text-sm text-gray-600 mb-2">{currentMatch.home_team}</div>
                        <div className="flex justify-center space-x-1 mb-2">
                          <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                        </div>
                        {currentMatch.joker_used_home && (
                          <Badge className="bg-purple-600">
                            <Star className="w-3 h-3 mr-1" />
                            Joker använd
                          </Badge>
                        )}
                      </div>
                      <div>
                        <div className="text-lg text-gray-400">-</div>
                        <Badge variant={currentMatch.status === 'confirmed' ? 'default' : currentMatch.status === 'live' ? 'destructive' : 'secondary'}>
                          {currentMatch.status === 'confirmed' ? 'Bekräftad' : currentMatch.status === 'live' ? 'Pågår' : 'Kommande'}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-4xl font-bold text-yellow-600">{currentMatch.away_score}</div>
                        <div className="text-sm text-gray-600 mb-2">{currentMatch.away_team}</div>
                        <div className="flex justify-center space-x-1 mb-2">
                          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                          <div className="w-4 h-4 bg-white border border-gray-300 rounded-full"></div>
                        </div>
                        {currentMatch.joker_used_away && (
                          <Badge className="bg-purple-600">
                            <Star className="w-3 h-3 mr-1" />
                            Joker använd
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Heat Program */}
                <Card>
                  <CardHeader>
                    <CardTitle>Heat Program</CardTitle>
                    <CardDescription>Alla 15 förbestämda heat för matchen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {currentMatch.heats?.map(heat => (
                        <div key={heat.heat_number} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold">Heat {heat.heat_number}</h4>
                            <div className="flex items-center space-x-2">
                              {heat.is_tactical_heat && (
                                <Badge className="bg-orange-500">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Taktisk
                                </Badge>
                              )}
                              {getStatusBadge(heat.status)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            {Object.keys(heat.riders).sort().map(gate => {
                              const rider = heat.riders[gate];
                              const result = heat.results?.find(r => r.rider_id === rider.rider_id);
                              
                              return (
                                <div key={gate} className={`text-center p-2 rounded ${getRiderGateStyle(rider.team, gate)}`}>
                                  <div className="flex items-center justify-center space-x-1">
                                    <span className="w-5 h-5 bg-gray-200 rounded-full text-xs flex items-center justify-center">
                                      {gate}
                                    </span>
                                    <div 
                                      className="w-3 h-3 rounded-full border" 
                                      style={{backgroundColor: rider.helmet_color, borderColor: rider.helmet_color === '#FFFFFF' ? '#ccc' : rider.helmet_color}}
                                    ></div>
                                  </div>
                                  <div className="font-medium text-xs mt-1">{rider.name}</div>
                                  {result && (
                                    <div className="mt-1">
                                      {result.status === 'completed' && (
                                        <Badge className={`text-xs ${getPositionColor(result.position)}`}>
                                          {result.position}. ({result.points}p)
                                        </Badge>
                                      )}
                                      {result.status === 'excluded' && (
                                        <Badge className="text-xs bg-red-600">
                                          <AlertTriangle className="w-3 h-3" />
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {user && (
                            <div className="flex space-x-2">
                              {heat.status === 'upcoming' && (
                                <Button 
                                  onClick={() => openHeatResult(heat)} 
                                  size="sm" 
                                  className="flex-1"
                                >
                                  Registrera resultat
                                </Button>
                              )}
                              {heat.status === 'completed' && currentMatch.status !== 'confirmed' && (
                                <Button 
                                  onClick={() => editHeatResult(heat)} 
                                  size="sm" 
                                  variant="outline"
                                  className="flex-1"
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Redigera
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* User Matches */}
          {user && (
            <TabsContent value="mina-matcher">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Mina matcher
                  </CardTitle>
                  <CardDescription>
                    Matcher du har fyllt i protokoll för
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userMatches.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">Du har inte fyllt i några matcher än</p>
                    ) : (
                      userMatches.map(userMatch => (
                        <div key={userMatch.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-4">
                              <div className="font-semibold">
                                {userMatch.match_details?.home_team} vs {userMatch.match_details?.away_team}
                              </div>
                              <Badge variant={
                                userMatch.status === 'validated' ? 'default' :
                                userMatch.status === 'disputed' ? 'destructive' : 'secondary'
                              }>
                                {userMatch.status === 'validated' ? 'Validerad' :
                                 userMatch.status === 'disputed' ? 'Konflikt' : 'Komplett'}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">
                                {userMatch.user_results.home_score} - {userMatch.user_results.away_score}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(userMatch.completed_at)}
                              </div>
                            </div>
                          </div>
                          
                          {userMatch.discrepancies && userMatch.discrepancies.length > 0 && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                              <div className="flex items-center mb-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                                <span className="font-medium text-yellow-800">Avvikelser upptäckta</span>
                              </div>
                              <div className="space-y-2 text-sm">
                                {userMatch.discrepancies.map((disc, index) => (
                                  <div key={index} className="flex justify-between">
                                    <span>
                                      {disc.type === 'home_score' ? 'Hemmalag poäng' : 'Bortalag poäng'}:
                                    </span>
                                    <span>
                                      Du: {disc.user_value} | Officiellt: {disc.official_value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex space-x-2 mt-3">
                                <Button 
                                  size="sm" 
                                  onClick={() => resolveDiscrepancy(userMatch.id, 'accept_official')}
                                  disabled={loading}
                                >
                                  Acceptera officiellt
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => resolveDiscrepancy(userMatch.id, 'keep_user')}
                                  disabled={loading}
                                >
                                  Behåll mitt
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Heat Result Dialog */}
        {currentHeat && (
          <Dialog open={!!currentHeat} onOpenChange={() => {setCurrentHeat(null); setEditingHeat(null);}}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingHeat ? 'Redigera' : 'Registrera'} Heat {currentHeat.heat_number} Resultat
                </DialogTitle>
                <DialogDescription>
                  {editingHeat ? 'Redigera placering och status för varje förare' : 'Registrera placering och status för varje förare'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {Object.keys(currentHeat.riders).sort().map(gate => {
                  const rider = currentHeat.riders[gate];
                  return (
                    <div key={gate} className={`flex items-center space-x-4 p-3 border rounded ${getRiderGateStyle(rider.team, gate)}`}>
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 bg-gray-200 rounded-full text-sm flex items-center justify-center">
                          {gate}
                        </span>
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{backgroundColor: rider.helmet_color, borderColor: rider.helmet_color === '#FFFFFF' ? '#ccc' : rider.helmet_color}}
                        ></div>
                        <span className="font-medium">{rider.name}</span>
                      </div>
                      
                      <div className="flex items-center space-x-2 flex-1">
                        <Select 
                          value={heatResults[rider.rider_id]?.status || 'completed'}
                          onValueChange={(value) => updateHeatResult(rider.rider_id, 'status', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="completed">Genomförd</SelectItem>
                            <SelectItem value="excluded">Utesluten</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {heatResults[rider.rider_id]?.status === 'completed' && (
                          <Select 
                            value={heatResults[rider.rider_id]?.position?.toString() || ''}
                            onValueChange={(value) => updateHeatResult(rider.rider_id, 'position', parseInt(value))}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue placeholder="Pos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1:a</SelectItem>
                              <SelectItem value="2">2:a</SelectItem>
                              <SelectItem value="3">3:e</SelectItem>
                              <SelectItem value="4">4:e</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        
                        {(canUseJoker('home') || canUseJoker('away')) && (
                          <Button
                            variant={jokerRider === rider.rider_id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (jokerRider === rider.rider_id) {
                                setJokerRider('');
                                setJokerTeam('');
                              } else {
                                setJokerRider(rider.rider_id);
                                setJokerTeam(rider.team);
                              }
                            }}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            Joker
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => {setCurrentHeat(null); setEditingHeat(null);}}>
                    <X className="w-4 h-4 mr-2" />
                    Avbryt
                  </Button>
                  <Button onClick={submitHeatResult} disabled={loading}>
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Sparar...' : 'Spara resultat'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Match Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Match bekräftad!</DialogTitle>
              <DialogDescription>
                Matchen har sparats i dina matcher.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {confirmationResult?.discrepancies && confirmationResult.discrepancies.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="flex items-center mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                    <span className="font-medium text-yellow-800">
                      Avvikelser upptäckta mot officiella resultat
                    </span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    Du kan granska och rätta detta i fliken "Mina matcher".
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => setShowConfirmDialog(false)}>
                  OK
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default App;

<script setup>
import { ref, onMounted, watch, computed } from 'vue'

const competitions = [
  { id: 2021, name: 'Premier League' },
  { id: 2014, name: 'La Liga' },
  { id: 2019, name: 'Serie A' },
  { id: 2002, name: 'Bundesliga' },
  { id: 2015, name: 'Ligue 1' },
  { id: 2001, name: 'UEFA Champions League' }
]

const statistics = ref([])
const teams = ref([])
const standings = ref([])
const selectedCompetition = ref(2021)

const loadingTeams = ref(false)
const loadingStandings = ref(false)
const teamsError = ref('')
const standingsError = ref('')

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const selectedCompetitionName = computed(() => {
  const competition = competitions.find(
    item => item.id === selectedCompetition.value
  )
  return competition?.name || 'Competition'
})

async function fetchStatistics() {
  try {
    const response = await fetch(`${API_URL}/api/statistics`)

    if (!response.ok) {
      throw new Error('Failed to fetch statistics')
    }

    statistics.value = await response.json()
  } catch (error) {
    console.error('Error fetching statistics:', error)
  }
}

async function fetchTeams(competitionId) {
  loadingTeams.value = true
  teamsError.value = ''
  teams.value = []

  try {
    const response = await fetch(
      `${API_URL}/api/database/competitions/${competitionId}/teams`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch teams')
    }

    const data = await response.json()

    if (competitionId === selectedCompetition.value) {
      teams.value = data
    }
  } catch (error) {
    console.error('Error fetching teams:', error)

    if (competitionId === selectedCompetition.value) {
      teamsError.value = 'Unable to load teams.'
    }
  } finally {
    if (competitionId === selectedCompetition.value) {
      loadingTeams.value = false
    }
  }
}

async function fetchStandings(competitionId) {
  loadingStandings.value = true
  standingsError.value = ''
  standings.value = []

  try {
    const response = await fetch(
      `${API_URL}/api/database/competitions/${competitionId}/standings`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch standings')
    }

    const data = await response.json()

    if (competitionId === selectedCompetition.value) {
      standings.value = data
    }
  } catch (error) {
    console.error('Error fetching standings:', error)

    if (competitionId === selectedCompetition.value) {
      standingsError.value = 'Unable to load standings.'
    }
  } finally {
    if (competitionId === selectedCompetition.value) {
      loadingStandings.value = false
    }
  }
}

watch(selectedCompetition, competitionId => {
  fetchTeams(competitionId)
  fetchStandings(competitionId)
})

function addGoal() {
  const goalsStat = statistics.value.find(
    stat => stat.title === 'Total Goals'
  )

  if (goalsStat) {
    goalsStat.value++
  }
}

function formatGoalDifference(value) {
  const number = Number(value) || 0
  return number > 0 ? `+${number}` : String(number)
}

onMounted(() => {
  fetchStatistics()
  fetchTeams(selectedCompetition.value)
  fetchStandings(selectedCompetition.value)
})
</script>


<template>
  <div class="app-container">

    <aside class="sidebar">
      <h2>⚽ FootyStats</h2>

      <nav>
        <a href="#" class="active">Dashboard</a>
        <a href="#standings">Standings</a>
        <a href="#teams">Leagues</a>
        <a href="#teams">Teams</a>
        <a href="#matches">Matches</a>
      </nav>
    </aside>

    <main class="main-content">

      <header class="header">
        <h1>Soccer Dashboard</h1>
        <p>Welcome to your soccer analytics center.</p>
      </header>

      <section class="stats-container">
        <div
          v-for="stat in statistics"
          :key="stat.title"
          class="stat-card"
        >
          <h3>{{ stat.title }}</h3>
          <p>{{ stat.value }}</p>
        </div>
      </section>

      <button class="goal-button" @click="addGoal">
        Add Goal
      </button>

      <section class="competition-section">
        <div class="teams-header">
          <div>
            <h2>{{ selectedCompetitionName }}</h2>
            <p class="section-description">
              Explore league standings, clubs, and players.
            </p>
          </div>

          <div class="league-selector">
            <label for="competition">Select Competition</label>

            <select
              id="competition"
              v-model.number="selectedCompetition"
            >
              <option
                v-for="competition in competitions"
                :key="competition.id"
                :value="competition.id"
              >
                {{ competition.name }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <!-- LEAGUE STANDINGS -->

      <section id="standings" class="standings-section">
        <div class="section-heading">
          <h2>{{ selectedCompetitionName }} Standings</h2>
          <p class="section-description">
            League table based on saved match results.
          </p>
        </div>

        <p v-if="loadingStandings" class="status-message">
          Loading standings...
        </p>

        <p v-else-if="standingsError" class="error-message">
          {{ standingsError }}
        </p>

        <div
          v-else-if="standings.length > 0"
          class="standings-table-wrapper"
        >
          <table class="standings-table">
            <thead>
              <tr>
                <th class="position-column">#</th>
                <th class="club-column">Club</th>
                <th title="Played">P</th>
                <th title="Won">W</th>
                <th title="Drawn">D</th>
                <th title="Lost">L</th>
                <th title="Goals For">GF</th>
                <th title="Goals Against">GA</th>
                <th title="Goal Difference">GD</th>
                <th class="points-column" title="Points">
                  Pts
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="team in standings"
                :key="team.team_id"
                :class="{
                  'ucl-direct': selectedCompetition === 2001 && team.position <= 8,
                  'ucl-playoff': selectedCompetition === 2001 && team.position >= 9 && team.position <= 24,
                  'ucl-eliminated': selectedCompetition === 2001 && team.position >= 25
                }"
              >
                <td class="position-cell">
                  {{ team.position }}
                </td>

                <td>
                  <RouterLink
                    :to="`/teams/${team.team_id}`"
                    class="standings-team-link"
                  >
                    <img
                      v-if="team.crest"
                      :src="team.crest"
                      :alt="team.name + ' crest'"
                      class="standings-crest"
                    />

                    <span>
                      {{ team.short_name || team.name }}
                    </span>
                  </RouterLink>
                </td>

                <td>{{ team.played }}</td>
                <td>{{ team.won }}</td>
                <td>{{ team.drawn }}</td>
                <td>{{ team.lost }}</td>
                <td>{{ team.goals_for }}</td>
                <td>{{ team.goals_against }}</td>

                <td>
                  {{ formatGoalDifference(team.goal_difference) }}
                </td>

                <td class="points-cell">
                  {{ team.points }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="status-message">
          No standings have been saved for this competition yet.
        </p>

        <div class="standings-legend">
          <span>P = Played</span>
          <span>W = Wins</span>
          <span>D = Draws</span>
          <span>L = Losses</span>
          <span>GF = Goals For</span>
          <span>GA = Goals Against</span>
          <span>GD = Goal Difference</span>
        </div>
      </section>

      <!-- COMPETITION TEAMS -->

      <section id="teams" class="teams-section">
        <div class="section-heading">
          <h2>{{ selectedCompetitionName }} Teams</h2>
          <p class="section-description">
            Select a club to explore its players and information.
          </p>
        </div>

        <p v-if="loadingTeams" class="status-message">
          Loading teams...
        </p>

        <p v-else-if="teamsError" class="error-message">
          {{ teamsError }}
        </p>

        <div v-else-if="teams.length > 0" class="teams-grid">
          <RouterLink
            v-for="team in teams"
            :key="team.id"
            :to="`/teams/${team.id}`"
            class="team-card"
          >
            <img
              v-if="team.crest"
              :src="team.crest"
              :alt="team.name + ' crest'"
              class="team-crest"
            />

            <h3>{{ team.short_name || team.name }}</h3>

            <p class="team-stadium">
              {{ team.stadium || 'Stadium unavailable' }}
            </p>

            <span class="team-abbreviation">
              {{ team.abbreviation || 'N/A' }}
            </span>
          </RouterLink>
        </div>

        <p v-else class="status-message">
          No teams found for this competition.
        </p>
      </section>

      <!-- RECENT MATCHES -->

      <section id="matches" class="matches-section">
        <h2>Recent Matches</h2>
        <p class="section-description">
          Sample match results
        </p>

        <div class="match">
          <span>Arsenal</span>
          <strong>2 - 1</strong>
          <span>Chelsea</span>
        </div>

        <div class="match">
          <span>Liverpool</span>
          <strong>3 - 0</strong>
          <span>Manchester United</span>
        </div>

        <div class="match">
          <span>Manchester City</span>
          <strong>2 - 2</strong>
          <span>Tottenham</span>
        </div>
      </section>

    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background-color: #f4f6f9;
  color: #1e293b;
}

.app-container {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 230px;
  min-width: 230px;
  background-color: #142b22;
  color: white;
  padding: 25px 20px;
}

.sidebar h2 {
  margin-bottom: 40px;
}

.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar a {
  color: #cbd5e1;
  text-decoration: none;
  padding: 12px;
  border-radius: 6px;
}

.sidebar a:hover,
.sidebar a.active {
  background-color: #246b45;
  color: white;
}

.main-content {
  flex: 1;
  min-width: 0;
  padding: 35px;
}

.header {
  margin-bottom: 30px;
}

.header h1 {
  margin-bottom: 8px;
}

.header p {
  color: #64748b;
}

.stats-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.stat-card {
  background-color: white;
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-card h3 {
  color: #64748b;
  font-size: 14px;
}

.stat-card p {
  font-size: 30px;
  font-weight: bold;
  margin-bottom: 0;
}

.goal-button {
  margin-top: 20px;
  padding: 12px 22px;
  background-color: #246b45;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.goal-button:hover {
  background-color: #185333;
}

.competition-section {
  margin-top: 35px;
}

.teams-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 20px;
}

.teams-header h2 {
  margin-bottom: 8px;
}

.section-description {
  color: #64748b;
  margin-bottom: 0;
}

.league-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.league-selector label {
  font-size: 13px;
  font-weight: bold;
  color: #64748b;
}

.league-selector select {
  padding: 12px 16px;
  min-width: 220px;
  background-color: white;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.league-selector select:focus {
  outline: 2px solid #246b45;
  outline-offset: 2px;
}

/* Standings */

.standings-section {
  margin-top: 30px;
  background-color: white;
  padding: 25px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-heading {
  margin-bottom: 22px;
}

.section-heading h2 {
  margin-bottom: 8px;
}

.standings-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.standings-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 650px;
}

.standings-table th {
  padding: 15px 10px;
  background-color: #f1f5f9;
  color: #64748b;
  text-align: center;
  font-size: 13px;
  font-weight: bold;
}

.standings-table td {
  padding: 14px 10px;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
  font-size: 14px;
}

.standings-table tbody tr:hover {
  background-color: #f8fafc;
}

.standings-table tbody tr:last-child td {
  border-bottom: none;
}

.standings-table .club-column {
  text-align: left;
}

.standings-table .position-column {
  width: 45px;
}

.position-cell {
  font-weight: bold;
  color: #475569;
}

.standings-team-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #1e293b;
  font-weight: 600;
  text-align: left;
}

.standings-team-link:hover {
  color: #246b45;
}

.standings-crest {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}

.standings-table .points-column {
  color: #246b45;
}

.points-cell {
  font-weight: bold;
  color: #246b45;
}

.standings-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-top: 22px;
  color: #64748b;
  font-size: 12px;
}

  /* Champions League qualification colors */

  /* Positions 1–8: Direct Round of 16 */
  .standings-table tbody tr.ucl-direct td:first-child {
    border-left: 5px solid #22c55e;
  }

  /* Positions 9–24: Knockout playoffs */
  .standings-table tbody tr.ucl-playoff td:first-child {
    border-left: 5px solid #3b82f6;
  }

  /* Positions 25–36: Eliminated */
  .standings-table tbody tr.ucl-eliminated td:first-child {
    border-left: 5px solid #ef4444;
  }

/* Teams */

.teams-section {
  margin-top: 35px;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
}

.team-card {
  display: block;
  background-color: white;
  border-radius: 10px;
  padding: 25px 15px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.team-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.team-crest {
  width: 70px;
  height: 70px;
  object-fit: contain;
  margin-bottom: 15px;
}

.team-card h3 {
  font-size: 16px;
  margin: 10px 0;
}

.team-stadium {
  font-size: 13px;
  color: #64748b;
  min-height: 35px;
}

.team-abbreviation {
  display: inline-block;
  margin-top: 10px;
  padding: 5px 10px;
  background-color: #e8f5ed;
  color: #246b45;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
}

.status-message {
  color: #64748b;
  padding: 20px 0;
}

.error-message {
  color: #b91c1c;
  padding: 20px 0;
}

/* Matches */

.matches-section {
  background-color: white;
  margin-top: 30px;
  padding: 25px;
  border-radius: 10px;
}

.match {
  display: flex;
  justify-content: space-between;
  padding: 18px 0;
  border-bottom: 1px solid #e2e8f0;
}

.match:last-child {
  border-bottom: none;
}

/* Responsive Layout */

@media (max-width: 900px) {
  .stats-container {
    grid-template-columns: repeat(2, 1fr);
  }

  .sidebar {
    width: 190px;
    min-width: 190px;
  }

  .main-content {
    padding: 25px;
  }
}

@media (max-width: 600px) {
  .app-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    min-width: 0;
  }

  .stats-container {
    grid-template-columns: 1fr;
  }

  .main-content {
    padding: 20px;
  }

  .teams-header {
    align-items: stretch;
    flex-direction: column;
  }

  .league-selector select {
    width: 100%;
  }

  .standings-section {
    padding: 16px;
  }
}
</style>

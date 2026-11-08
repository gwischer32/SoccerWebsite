
<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Backend URL for local development and deployment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Store the team returned by MySQL
const team = ref(null)
const loading = ref(true)
const error = ref('')

// Store the players returned by MySQL
const players = ref([])
const playersLoading = ref(true)
const playersError = ref('')

// Organize players into position groups
const positionGroups = computed(() => [
  {
    title: 'Goalkeepers',
    players: players.value.filter(
      player => player.position === 'Goalkeeper'
    )
  },
  {
    title: 'Defenders',
    players: players.value.filter(
      player => player.position === 'Defence'
    )
  },
  {
    title: 'Midfielders',
    players: players.value.filter(
      player => player.position === 'Midfield'
    )
  },
  {
    title: 'Forwards',
    players: players.value.filter(
      player => player.position === 'Offence'
    )
  },
  {
    title: 'Other Players',
    players: players.value.filter(
      player => !['Goalkeeper', 'Defence', 'Midfield', 'Offence']
        .includes(player.position)
    )
  }
])

// Fetch one team using its ID
async function fetchTeam() {
  loading.value = true
  error.value = ''
  team.value = null

  try {
    const teamId = route.params.id

    const response = await fetch(
      `${API_URL}/api/database/teams/${teamId}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch team')
    }

    team.value = await response.json()

  } catch (err) {
    console.error('Error fetching team:', err)
    error.value = 'Unable to load team information.'
  } finally {
    loading.value = false
  }
}

// Fetch players for the selected team
async function fetchPlayers() {
  playersLoading.value = true
  playersError.value = ''
  players.value = []

  try {
    const teamId = route.params.id

    const response = await fetch(
      `${API_URL}/api/database/teams/${teamId}/players`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch players')
    }

    players.value = await response.json()

  } catch (err) {
    console.error('Error fetching players:', err)
    playersError.value = 'Unable to load player roster.'
  } finally {
    playersLoading.value = false
  }
}

// Fetch team and players when page loads
onMounted(() => {
  fetchTeam()
  fetchPlayers()
})

// Fetch again if the URL changes to another team
watch(() => route.params.id, () => {
  fetchTeam()
  fetchPlayers()
})
</script>


<template>
  <div class="team-page">

    <RouterLink to="/" class="back-link">
      ← Back to Dashboard
    </RouterLink>

    <p v-if="loading">Loading team information...</p>

    <p v-else-if="error">{{ error }}</p>

    <div v-else-if="team" class="team-details">

      <img
        :src="team.crest"
        :alt="team.name + ' crest'"
        class="team-crest"
      />

      <!-- Full club name underneath the badge -->
      <h1 class="team-name">{{ team.name }}</h1>

      <!-- Club Information -->
      <div class="info-card">
        <h2>Club Information</h2>

        <p><strong>Stadium:</strong> {{ team.stadium }}</p>

        <p><strong>Founded:</strong> {{ team.founded }}</p>

        <p><strong>Short Name:</strong> {{ team.short_name }}</p>

        <p><strong>Abbreviation:</strong> {{ team.abbreviation }}</p>
      </div>

      <!-- Player Roster -->
      <section class="roster-section">
        <h2>Player Roster</h2>

        <p v-if="playersLoading">
          Loading players...
        </p>

        <p v-else-if="playersError">
          {{ playersError }}
        </p>

        <p v-else-if="players.length === 0">
          No players have been added for this team yet.
        </p>

        <template v-else>
          <p class="player-count">
            {{ players.length }} players
          </p>

          <div
            v-for="group in positionGroups"
            :key="group.title"
          >
            <div
              v-if="group.players.length > 0"
              class="position-group"
            >
              <h3>{{ group.title }}</h3>

              <div class="players-grid">
                <div
                  v-for="player in group.players"
                  :key="player.id"
                  class="player-card"
                >
                  <h4>{{ player.name }}</h4>

                  <p>{{ player.nationality || 'Unknown nationality' }}</p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </section>

    </div>
  </div>
</template>

<style scoped>
.team-page {
  padding: 40px;
  min-height: 100vh;
  background-color: #f4f6f9;
}

.back-link {
  color: #246b45;
  text-decoration: none;
  font-weight: bold;
}

.back-link:hover {
  text-decoration: underline;
}

.team-details {
  text-align: center;
  margin-top: 40px;
}

.team-crest {
  width: 130px;
  height: 130px;
  object-fit: contain;
}

/* Full club name */
.team-name {
  display: block;
  margin-top: 20px;
  margin-bottom: 20px;
  font-size: 32px;
  font-weight: bold;
  color: #246b45;
  text-align: center;
}

/* Club Information */
.info-card {
  background-color: white;
  padding: 30px;
  border-radius: 10px;
  max-width: 500px;
  margin: 30px auto;
  text-align: left;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.info-card h2 {
  margin-top: 0;
  color: #246b45;
}

.info-card p {
  padding: 10px 0;
  border-bottom: 1px solid #e2e8f0;
}

.info-card p:last-child {
  border-bottom: none;
}

/* Player Roster */
.roster-section {
  max-width: 1000px;
  margin: 50px auto;
  text-align: left;
}

.roster-section > h2 {
  color: #246b45;
  font-size: 28px;
  text-align: center;
}

.player-count {
  color: #64748b;
  text-align: center;
  margin-bottom: 30px;
}

.position-group {
  margin-bottom: 35px;
}

.position-group h3 {
  color: #246b45;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 12px;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.player-card {
  background-color: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}

.player-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.1);
}

.player-card h4 {
  margin: 0 0 10px;
  color: #1e293b;
  font-size: 16px;
}

.player-card p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

@media (max-width: 600px) {
  .team-page {
    padding: 20px;
  }

  .players-grid {
    grid-template-columns: 1fr;
  }
}
</style>

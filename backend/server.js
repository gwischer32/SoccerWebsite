
const express = require('express')
const cors = require('cors')
const pool = require('./db')
require('dotenv').config()

const app = express()

app.use(cors({
  origin: 'http://localhost:5173'
}))

const PORT = 3000

app.get('/', (req, res) => {
  res.send('Welcome to the Soccer Statistics API!')
})

app.get('/api/statistics', (req, res) => {
    const statistics = [
      { title: 'Total Teams', value: 20 },
      { title: 'Total Players', value: 500 },
      { title: 'Matches Played', value: 180 },
      { title: 'Total Goals', value: 542 }
    ]
  
    res.json(statistics)
  })

app.get('/api/teams', async (req, res) => {
    try {
      const response = await fetch(
        'https://api.football-data.org/v4/competitions/PL/teams',
        {
          headers: {
            'X-Auth-Token': process.env.FOOTBALL_API_KEY
          }
        }
      )
  
      if (!response.ok) {
        const errorDetails = await response.text()
      
        throw new Error(
          `API request failed: ${response.status} - ${errorDetails}`
        )
      }
  
      const data = await response.json()
  
      res.json(data.teams)
  
    } catch (error) {
      console.error('Error fetching teams:', error)
      res.status(500).json({ error: 'Failed to fetch teams' })
    }
  })


app.get('/api/sync-teams', async (req, res) => {
    try {
      const response = await fetch(
        'https://api.football-data.org/v4/competitions/PL/teams',
        {
          headers: {
            'X-Auth-Token': process.env.FOOTBALL_API_KEY
          }
        }
      )
  
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }
  
      const data = await response.json()
  
      for (const team of data.teams) {
        await pool.execute(
          `INSERT INTO teams
          (id, name, short_name, abbreviation, stadium, founded, crest)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            short_name = VALUES(short_name),
            abbreviation = VALUES(abbreviation),
            stadium = VALUES(stadium),
            founded = VALUES(founded),
            crest = VALUES(crest)`,
          [
            team.id,
            team.name,
            team.shortName,
            team.tla,
            team.venue,
            team.founded,
            team.crest
          ]
        )
      }
  
      res.json({
        message: 'Teams successfully saved to MySQL!',
        teamsProcessed: data.teams.length
      })
  
    } catch (error) {
      console.error('Error syncing teams:', error)
      res.status(500).json({ error: 'Failed to sync teams' })
    }
  })
  

  app.get('/api/database/teams', async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM teams ORDER BY name'
      )
  
      res.json(rows)
  
    } catch (error) {
      console.error('Error retrieving teams:', error)
  
      res.status(500).json({
        error: 'Failed to retrieve teams from database'
      })
    }
  })
  
app.get('/api/database/teams/:id', async (req, res) => {
  try {
    const teamId = req.params.id

    const [rows] = await pool.execute(
      'SELECT * FROM teams WHERE id = ?',
      [teamId]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Team not found'
      })
    }

    res.json(rows[0])

  } catch (error) {
    console.error('Error retrieving team:', error)

    res.status(500).json({
      error: 'Failed to retrieve team'
    })
  }
})

app.get('/api/test-roster/:id', async (req, res) => {
  try {
    const teamId = req.params.id

    const response = await fetch(
      `https://api.football-data.org/v4/teams/${teamId}`,
      {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_API_KEY
        }
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    res.json({
      team: data.name,
      playerCount: data.squad?.length ?? 0,
      players: data.squad ?? []
    })

  } catch (error) {
    console.error('Error fetching roster:', error)

    res.status(500).json({
      error: 'Failed to fetch roster'
    })
  }
})

app.get('/api/sync-players/:id', async (req, res) => {
  try {
    const teamId = req.params.id

    // Request the team's roster from football-data.org
    const response = await fetch(
      `https://api.football-data.org/v4/teams/${teamId}`,
      {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_API_KEY
        }
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    // Save each player into MySQL
    for (const player of data.squad || []) {
      await pool.query(
        `INSERT INTO players
         (id, team_id, name, position, date_of_birth, nationality)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           team_id = VALUES(team_id),
           name = VALUES(name),
           position = VALUES(position),
           date_of_birth = VALUES(date_of_birth),
           nationality = VALUES(nationality)`,
        [
          player.id,
          teamId,
          player.name,
          player.position,
          player.dateOfBirth,
          player.nationality
        ]
      )
    }

    res.json({
      message: 'Players successfully saved to MySQL',
      team: data.name,
      playersSaved: data.squad?.length || 0
    })

  } catch (error) {
    console.error('Error syncing players:', error)

    res.status(500).json({
      error: 'Failed to sync players'
    })
  }
})

// Get all players belonging to a specific team
app.get('/api/database/teams/:id/players', async (req, res) => {
  try {
    const teamId = req.params.id

    const [players] = await pool.query(
      `SELECT id, name, position, date_of_birth, nationality
       FROM players
       WHERE team_id = ?
       ORDER BY position, name`,
      [teamId]
    )

    res.json(players)

  } catch (error) {
    console.error('Error fetching team players:', error)

    res.status(500).json({
      error: 'Failed to fetch team players'
    })
  }
})

// Sync player rosters for all Premier League teams
app.get('/api/sync-all-players', async (req, res) => {
  try {
    // Retrieve all teams from MySQL
    const [teams] = await pool.query(
      'SELECT id, name FROM teams'
    )

    const results = []

    for (const team of teams) {
      try {
        // Request this team's roster
        const response = await fetch(
          `https://api.football-data.org/v4/teams/${team.id}`,
          {
            headers: {
              'X-Auth-Token': process.env.FOOTBALL_API_KEY
            }
          }
        )

        if (!response.ok) {
          results.push({
            team: team.name,
            status: 'failed',
            httpStatus: response.status
          })
          continue
        }

        const data = await response.json()
        const squad = data.squad || []

        // Save players to MySQL
        for (const player of squad) {
          await pool.query(
            `INSERT INTO players
             (id, team_id, name, position, date_of_birth, nationality)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               team_id = VALUES(team_id),
               name = VALUES(name),
               position = VALUES(position),
               date_of_birth = VALUES(date_of_birth),
               nationality = VALUES(nationality)`,
            [
              player.id,
              team.id,
              player.name,
              player.position,
              player.dateOfBirth,
              player.nationality
            ]
          )
        }

        results.push({
          team: team.name,
          status: 'success',
          playersSaved: squad.length
        })

      } catch (error) {
        console.error(`Error syncing ${team.name}:`, error)

        results.push({
          team: team.name,
          status: 'failed',
          error: error.message
        })
      }

      // Wait 7 seconds between requests to reduce API rate-limit errors
      await new Promise(resolve => setTimeout(resolve, 7000))
    }

    res.json({
      message: 'Premier League roster synchronization finished',
      results
    })

  } catch (error) {
    console.error('Error syncing all players:', error)

    res.status(500).json({
      error: 'Failed to sync Premier League rosters'
    })
  }
})

// Synchronize teams for any competition stored in MySQL
app.get('/api/sync-competition/:id', async (req, res) => {
  try {
    const competitionId = Number(req.params.id)

    // Make sure the competition exists in our database
    const [competitions] = await pool.query(
      'SELECT id, name, code FROM competitions WHERE id = ?',
      [competitionId]
    )

    if (competitions.length === 0) {
      return res.status(404).json({
        error: 'Competition not found in database'
      })
    }

    const competition = competitions[0]

    // Retrieve teams from football-data.org
    const response = await fetch(
      `https://api.football-data.org/v4/competitions/${competition.code}/teams`,
      {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_API_KEY
        }
      }
    )

    if (!response.ok) {
      const details = await response.text()

      return res.status(response.status).json({
        error: 'Failed to retrieve competition teams',
        details
      })
    }

    const data = await response.json()
    const teams = data.teams || []

    // Don't modify existing relationships if the API
    // unexpectedly returns an empty team list
    if (teams.length === 0) {
      return res.status(502).json({
        error: 'No teams returned by football-data.org'
      })
    }

    for (const team of teams) {
      // Insert new teams or update existing teams
      await pool.query(
        `INSERT INTO teams
         (id, name, short_name, abbreviation, stadium, founded, crest)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           short_name = VALUES(short_name),
           abbreviation = VALUES(abbreviation),
           stadium = VALUES(stadium),
           founded = VALUES(founded),
           crest = VALUES(crest)`,
        [
          team.id,
          team.name,
          team.shortName ?? null,
          team.tla ?? null,
          team.venue ?? null,
          team.founded ?? null,
          team.crest ?? null
        ]
      )

      // Associate this team with the competition
      await pool.query(
        `INSERT IGNORE INTO competition_teams
         (competition_id, team_id)
         VALUES (?, ?)`,
        [competitionId, team.id]
      )
    }

    res.json({
      message: 'Competition teams synchronized successfully',
      competition: competition.name,
      teamsProcessed: teams.length
    })

  } catch (error) {
    console.error('Error syncing competition:', error)

    res.status(500).json({
      error: 'Failed to synchronize competition'
    })
  }
})

// Get all teams belonging to a specific competition
app.get('/api/database/competitions/:id/teams', async (req, res) => {
  try {
    const competitionId = req.params.id

    const [teams] = await pool.query(
      `SELECT teams.*
       FROM teams
       INNER JOIN competition_teams
         ON teams.id = competition_teams.team_id
       WHERE competition_teams.competition_id = ?
       ORDER BY teams.name`,
      [competitionId]
    )

    res.json(teams)

  } catch (error) {
    console.error('Error fetching competition teams:', error)

    res.status(500).json({
      error: 'Failed to fetch competition teams'
    })
  }
})

// Synchronize player rosters for one competition
app.get('/api/sync-competition-players/:id', async (req, res) => {
  try {
    const competitionId = Number(req.params.id)

    const [competitions] = await pool.query(
      'SELECT name FROM competitions WHERE id = ?',
      [competitionId]
    )

    if (competitions.length === 0) {
      return res.status(404).json({
        error: 'Competition not found'
      })
    }

    // Get teams that belong to the selected competition
    const [teams] = await pool.query(
      `SELECT t.id, t.name
       FROM teams t
       INNER JOIN competition_teams ct
         ON t.id = ct.team_id
       WHERE ct.competition_id = ?
       ORDER BY t.name`,
      [competitionId]
    )

    const results = []

    for (const team of teams) {
      try {
        const response = await fetch(
          `https://api.football-data.org/v4/teams/${team.id}`,
          {
            headers: {
              'X-Auth-Token': process.env.FOOTBALL_API_KEY
            }
          }
        )

        if (!response.ok) {
          results.push({
            team: team.name,
            status: 'failed',
            httpStatus: response.status
          })
        } else {
          const data = await response.json()
          const squad = data.squad || []

          for (const player of squad) {
            await pool.query(
              `INSERT INTO players
               (id, team_id, name, position, date_of_birth, nationality)
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 team_id = VALUES(team_id),
                 name = VALUES(name),
                 position = VALUES(position),
                 date_of_birth = VALUES(date_of_birth),
                 nationality = VALUES(nationality)`,
              [
                player.id,
                team.id,
                player.name,
                player.position ?? null,
                player.dateOfBirth ?? null,
                player.nationality ?? null
              ]
            )
          }

          results.push({
            team: team.name,
            status: 'success',
            playersSaved: squad.length
          })
        }
      } catch (error) {
        console.error(`Error syncing ${team.name}:`, error)

        results.push({
          team: team.name,
          status: 'failed',
          error: error.message
        })
      }

      // Wait 7 seconds to reduce API rate-limit errors
      await new Promise(resolve => setTimeout(resolve, 7000))
    }

    res.json({
      message: 'Competition player synchronization finished',
      competition: competitions[0].name,
      teamsProcessed: teams.length,
      results
    })

  } catch (error) {
    console.error('Error syncing competition players:', error)

    res.status(500).json({
      error: 'Failed to synchronize competition players'
    })
  }
})
// Get league standings from MySQL
app.get('/api/database/competitions/:id/standings', async (req, res) => {
  try {
    const competitionId = req.params.id

    const [standings] = await pool.query(
      `SELECT
         s.position,
         s.team_id,
         t.name,
         t.short_name,
         t.crest,
         s.played,
         s.won,
         s.drawn,
         s.lost,
         s.goals_for,
         s.goals_against,
         s.goal_difference,
         s.points,
         s.season
       FROM standings s
       INNER JOIN teams t ON s.team_id = t.id
       WHERE s.competition_id = ?
         AND s.season = (
           SELECT MAX(season)
           FROM standings
           WHERE competition_id = ?
         )
       ORDER BY s.position ASC`,
      [competitionId, competitionId]
    )

    res.json(standings)
  } catch (error) {
    console.error('Error fetching standings:', error)
    res.status(500).json({
      error: 'Failed to fetch standings'
    })
  }
})

app.get('/api/sync-standings/:id', async (req, res) => {
  try {
    const competitionId = Number(req.params.id)

    // Find the competition in MySQL.
    const [competitions] = await pool.query(
      'SELECT id, name, code FROM competitions WHERE id = ?',
      [competitionId]
    )

    if (competitions.length === 0) {
      return res.status(404).json({
        error: 'Competition not found'
      })
    }

    const competition = competitions[0]

    // Fetch completed matches from football-data.org.
    const response = await fetch(
      `https://api.football-data.org/v4/competitions/${competition.code}/matches?status=FINISHED`,
      {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_API_KEY
        }
      }
    )

    if (!response.ok) {
      const details = await response.text()

      return res.status(response.status).json({
        error: 'Failed to retrieve matches',
        details
      })
    }

    const data = await response.json()
    const matches = data.matches || []

    if (matches.length === 0) {
      return res.status(404).json({
        error: 'No completed matches available'
      })
    }

    // Keep matches from the latest season returned.
    const seasons = matches
      .map(match => match.season?.startDate)
      .filter(Boolean)

    if (seasons.length === 0) {
      return res.status(502).json({
        error: 'Match data has no season information'
      })
    }

    const latestSeason = Math.max(
      ...seasons.map(date => Number(date.slice(0, 4)))
    )

    const seasonMatches = matches.filter(match => {
      const isCurrentSeason =
        Number(match.season?.startDate?.slice(0, 4)) === latestSeason
    
      // Champions League: only count league-phase matches.
      if (competitionId === 2001) {
        return (
          isCurrentSeason &&
          match.stage === 'LEAGUE_STAGE'
        )
      }
    
      // Domestic leagues: count all finished matches.
      return isCurrentSeason
    })

    const table = new Map()

    function getTeam(team) {
      if (!table.has(team.id)) {
        table.set(team.id, {
          team_id: team.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          goal_difference: 0,
          points: 0
        })
      }

      return table.get(team.id)
    }

    for (const match of seasonMatches) {
      // Only count completed matches with valid scores.
      const homeGoals = match.score?.fullTime?.home
      const awayGoals = match.score?.fullTime?.away

      if (
        match.status !== 'FINISHED' ||
        homeGoals == null ||
        awayGoals == null ||
        !match.homeTeam?.id ||
        !match.awayTeam?.id
      ) {
        continue
      }

      const home = getTeam(match.homeTeam)
      const away = getTeam(match.awayTeam)

      home.played++
      away.played++

      home.goals_for += homeGoals
      home.goals_against += awayGoals

      away.goals_for += awayGoals
      away.goals_against += homeGoals

      if (homeGoals > awayGoals) {
        home.won++
        home.points += 3
        away.lost++
      } else if (awayGoals > homeGoals) {
        away.won++
        away.points += 3
        home.lost++
      } else {
        home.drawn++
        away.drawn++
        home.points++
        away.points++
      }
    }

    const standings = Array.from(table.values())

    for (const team of standings) {
      team.goal_difference =
        team.goals_for - team.goals_against
    }

    standings.sort((a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team_id - b.team_id
    )

    // Save results to the existing standings table.
    for (let index = 0; index < standings.length; index++) {
      const team = standings[index]

      await pool.query(
        `INSERT INTO standings (
          competition_id,
          team_id,
          season,
          position,
          played,
          won,
          drawn,
          lost,
          goals_for,
          goals_against,
          goal_difference,
          points
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          position = VALUES(position),
          played = VALUES(played),
          won = VALUES(won),
          drawn = VALUES(drawn),
          lost = VALUES(lost),
          goals_for = VALUES(goals_for),
          goals_against = VALUES(goals_against),
          goal_difference = VALUES(goal_difference),
          points = VALUES(points)`,
        [
          competitionId,
          team.team_id,
          latestSeason,
          index + 1,
          team.played,
          team.won,
          team.drawn,
          team.lost,
          team.goals_for,
          team.goals_against,
          team.goal_difference,
          team.points
        ]
      )
    }

    res.json({
      message: 'Standings synchronized successfully',
      competition: competition.name,
      season: latestSeason,
      matchesProcessed: seasonMatches.length,
      teamsProcessed: standings.length
    })
  } catch (error) {
    console.error('Error syncing standings:', error)

    res.status(500).json({
      error: 'Failed to synchronize standings',
      details: error.message
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

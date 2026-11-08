
const mysql = require('mysql2/promise')
require('dotenv').config()

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
})

module.exports = pool






async function testConnection() {
    try {
      const connection = await pool.getConnection()
      console.log('Successfully connected to MySQL!')
      connection.release()
    } catch (error) {
      console.error('MySQL connection failed:', error.message)
    } finally {
      await pool.end()
    }
  }
  
  if (require.main === module) {
    testConnection()
  }
  
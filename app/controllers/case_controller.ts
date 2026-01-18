import { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class CaseController {
  // 获取案件数据的API
  async getCaseData({ params, response }: HttpContext) {
    const { caseId } = params
    try {
      const caseData = await db.rawQuery(`
        WITH current_case AS (
          SELECT id, case_id, full_name, missing_state, age_at_missing, title, case_summary, url_path, ai_status, created_at, updated_at FROM missing_persons_info WHERE case_id = ?
        )
        SELECT
          c.*,
          (SELECT case_id FROM missing_persons_info WHERE id < c.id ORDER BY id DESC LIMIT 1) as prev_id,
          (SELECT case_id FROM missing_persons_info WHERE id > c.id ORDER BY id ASC LIMIT 1) as next_id,
          (SELECT jsonb_agg(r) FROM (
            SELECT case_id, full_name FROM missing_persons_info
            WHERE missing_state = c.missing_state AND case_id != c.case_id
            LIMIT 4
          ) r) as recommendations
        FROM current_case c
      `, [caseId])
      if (caseData.rows.length === 0) {
        return response.status(404).json({ error: 'Case not found' })
      }
      return response.json(caseData.rows[0])
    } catch (error) {
      console.error('Error fetching case data:', error)
      return response.status(500).json({ error: 'Internal server error' })
    }
  }

  // 获取随机案件ID
  async getRandomCaseId({ response }: HttpContext) {
    try {
      const randomCase = await db.rawQuery(`
        SELECT case_id FROM missing_persons_info
        OFFSET floor(random() * (SELECT count(*) FROM missing_persons_info))
        LIMIT 1
      `)
      if (randomCase.rows.length === 0) {
        return response.status(404).json({ error: 'No cases found' })
      }
      return response.json({ caseId: randomCase.rows[0].case_id })
    } catch (error) {
      console.error('Error fetching random case:', error)
      return response.status(500).json({ error: 'Internal server error' })
    }
  }
}
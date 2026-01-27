/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

// 定义接口
interface AssetRow {
  new_filename: string
  alt_zh: string | null
  caption_zh: string | null
  width: number | null
  height: number | null
  is_primary: number
  sort_order: number
}

// API路由
router.get('/api/case/random', async ({ response }) => {
  try {
    const randomCase = await db.rawQuery(`
      SELECT case_id, url_path FROM missing_persons_info
      OFFSET floor(random() * (SELECT count(*) FROM missing_persons_info))
      LIMIT 1
    `)
    if (randomCase.rows.length === 0) {
      return response.status(404).json({ error: 'No cases found' })
    }
    
    const caseData = randomCase.rows[0]
    const caseId = caseData.case_id
    
    // 查询所有图片信息
    const imageResult = await db.rawQuery(`
      SELECT new_filename, alt_zh, caption_zh, width, height, is_primary, sort_order
      FROM missing_persons_assets 
      WHERE case_id = ?
      ORDER BY sort_order ASC
    `, [caseId])
    
    const imgBaseUrl = env.get('IMG_BASE_URL', 'img.gudq.com')
    const images = imageResult.rows.map((asset: AssetRow) => {
      // 构建正确的图片路径：/missing/州/县/城市/案件id/具体图片名
        const imagePath = `missing/${caseData.url_path}/${caseId}/${asset.new_filename}`
      return {
        url: `https://${imgBaseUrl}/${imagePath}`,
        alt: asset.alt_zh || '',
        caption: asset.caption_zh || '',
        width: asset.width || 0,
        height: asset.height || 0,
        isPrimary: asset.is_primary === 1,
        sortOrder: asset.sort_order
      }
    })
    
    return response.json({
      caseId,
      images
    })
  } catch (error) {
    console.error('Error fetching random case:', error)
    return response.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/api/case/:caseId', async ({ params, response }) => {
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
    
    const caseInfo = caseData.rows[0]
    
    // 查询所有图片信息
    const imageResult = await db.rawQuery(`
      SELECT new_filename, alt_zh, caption_zh, width, height, is_primary, sort_order
      FROM missing_persons_assets 
      WHERE case_id = ?
      ORDER BY sort_order ASC
    `, [caseId])
    
    const imgBaseUrl = env.get('IMG_BASE_URL', 'img.gudq.com')
    const images = imageResult.rows.map((asset: AssetRow) => {
      // 构建正确的图片路径：/missing/州/县/城市/案件id/具体图片名
        const imagePath = `missing/${caseInfo.url_path}/${caseId}/${asset.new_filename}`
      return {
        url: `https://${imgBaseUrl}/${imagePath}`,
        alt: asset.alt_zh || '',
        caption: asset.caption_zh || '',
        width: asset.width || 0,
        height: asset.height || 0,
        isPrimary: asset.is_primary === 1,
        sortOrder: asset.sort_order
      }
    })
    
    return response.json({
      ...caseInfo,
      images
    })
  } catch (error) {
    console.error('Error fetching case data:', error)
    return response.status(500).json({ error: 'Internal server error' })
  }
})

// 默认路由
router.get('/', async () => {
  return {
    hello: 'world',
  }
})

// 静态文件路由 - 提供CSS文件
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

router.get('/dist/localtailwind.css', async ({ response }) => {
  try {
    const cssPath = resolve(process.cwd(), 'dist', 'localtailwind.css')
    const cssContent = await readFile(cssPath)
    
    response.header('Content-Type', 'text/css')
    response.header('Cache-Control', 'public, max-age=3600')
    return cssContent
  } catch (error) {
    response.status(404).send('CSS file not found')
  }
})
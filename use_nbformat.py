import nbformat as nbf

# 创建一个新的notebook
nb = nbf.v4.new_notebook()

# 添加markdown单元格
nb.cells.append(nbf.v4.new_markdown_cell("# Gemini Summary Task\n\nThis notebook implements the same functionality as the `node ace gemini:summary` command."))

# 添加代码单元格：导入库
nb.cells.append(nbf.v4.new_code_cell("""
import os
import sys
import re
import json
import requests
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
"""))

# 添加代码单元格：GeminiService类
nb.cells.append(nbf.v4.new_code_cell("""
class GeminiService:
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY', '')
        self.base_url = 'https://chatgpt-proxy.guomengtao.workers.dev'
        self.available_models = [
            'models/gemini-1.5-flash-latest',
            'models/gemini-1.5-pro-latest',
            'models/gemini-1.0-pro-latest'
        ]
    
    def generateMultiLangSummary(self, details, max_retries=3):
        for i in range(max_retries):
            model_index = i % len(self.available_models)
            model_name = self.available_models[model_index]
            
            try:
                # Prepare prompt
                prompt = "你是一位精通中文、英语、西班牙语的国际寻人专家和多语言 SEO 资深编辑。请分析以下失踪详情：\n" + details + "\n\n任务：为该案件生成中、英、西三语的 SEO 摘要（Summary）。\n\n输出格式要求（必须是合法 JSON，严禁任何额外解释）：\nJSON\n[\n  {\n    \"lang\": \"zh\",\n    \"summary\": \"（150-300字的中文摘要。结构：姓名+时间+地点；核心体貌/衣着特征；呼吁行动。）\"\n  },\n  {\n    \"lang\": \"en\",\n    \"summary\": \"（150-300 words English summary. Professional, native tone, no robotic translation.）\"\n  },\n  {\n    \"lang\": \"es\",\n    \"summary\": \"（Resumen en español de 150-300 palabras. Estilo natural y urgente para búsqueda de personas.）\"\n  }\n]\n\n字段约束准则（严格遵守数据库 NOT NULL 约束）：\nlang: 必须且只能是 zh, en, es 中的一个。\nsummary: 严禁为空。如果原文信息极少，请根据已知碎片信息进行合理扩充描述。\n\n内容策略:\n英文摘要需符合母语习惯（使用 \"Last seen wearing\", \"Anyone with information\" 等）。\n西语摘要需地道（使用 \"Visto por última vez\", \"Se solicita colaboración\" 等）。\n语言风格需庄重、客观，禁止使用感叹号。"
                
                # Send request to proxy
                url = f'{self.base_url}/v1beta/models/{model_name.replace("models/", "")}:generateContent'
                response = requests.post(
                    url,
                    json={
                        'contents': [
                            {
                                'parts': [{'text': prompt}]
                            }
                        ]
                    },
                    params={'key': self.api_key}
                )
                response.raise_for_status()
                
                # Parse response
                data = response.json()
                text = data['candidates'][0]['content']['parts'][0]['text']
                
                # Clean and validate JSON
                text = re.sub(r'^.*?\\[', '[', text, flags=re.DOTALL)
                text = re.sub(r'\\].*?$', ']', text, flags=re.DOTALL)
                summaries = json.loads(text)
                
                # Validate output
                valid_langs = {'zh', 'en', 'es'}
                if len(summaries) != 3:
                    raise ValueError('Expected 3 summaries')
                
                for summary in summaries:
                    if summary['lang'] not in valid_langs:
                        raise ValueError(f'Invalid language: {summary["lang"]}')
                    if not summary['summary']:
                        raise ValueError('Empty summary')
                
                return summaries
            except Exception as e:
                print(f'Model {model_name} failed: {e}')
                if i == max_retries - 1:
                    raise
                print(f'Retrying with model {self.available_models[(i+1) % len(self.available_models)]}...')
"""))

# 添加代码单元格：DatabaseService类
nb.cells.append(nbf.v4.new_code_cell("""
class DatabaseService:
    def __init__(self):
        self.conn = psycopg2.connect(
            dbname=os.getenv('PG_DB_NAME'),
            user=os.getenv('PG_USER'),
            password=os.getenv('PG_PASSWORD'),
            host=os.getenv('PG_HOST'),
            port=os.getenv('PG_PORT', '5432')
        )
        self.cursor = self.conn.cursor()
    
    def get_cases_to_process(self):
        sql = "SELECT " \
              "    c.id, c.title, c.description, c.content, c.case_number, c.keywords, c.address," \
              "    c.district_id, c.city_id, c.province_id, c.country_id," \
              "    cd.details " \
              "FROM cases c" \
              "LEFT JOIN case_details cd ON c.id = cd.case_id" \
              "LEFT JOIN case_summaries cs ON c.id = cs.case_id" \
              "WHERE c.status = 'published'" \
              "AND (cs.id IS NULL OR cs.updated_at < c.updated_at)" \
              "ORDER BY c.created_at DESC"
        self.cursor.execute(sql)
        return self.cursor.fetchall()
    
    def save_summary(self, case_id, lang, summary):
        sql = "INSERT INTO case_summaries (case_id, lang, summary, created_at, updated_at) " \
              "VALUES (%s, %s, %s, NOW(), NOW()) " \
              "ON CONFLICT (case_id, lang) " \
              "DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()"
        self.cursor.execute(sql, (case_id, lang, summary))
        self.conn.commit()
    
    def close(self):
        self.cursor.close()
        self.conn.close()
"""))

# 添加代码单元格：GeminiSummaryRunner类
nb.cells.append(nbf.v4.new_code_cell("""
class GeminiSummaryRunner:
    def __init__(self):
        self.gemini_service = GeminiService()
        self.db_service = DatabaseService()
    
    def clean_html(self, html):
        if not html:
            return ''
        text = re.sub(r'<[^>]+>', '', html)
        text = re.sub(r'\\s+', ' ', text).strip()
        return text
    
    def get_case_details(self, case):
        details_parts = []
        
        if case[1]:  # title
            details_parts.append(f'标题: {case[1]}')
        
        if case[2]:  # description
            details_parts.append(f'描述: {case[2]}')
        
        if case[3]:  # content
            content = self.clean_html(case[3])
            details_parts.append(f'详细内容: {content}')
        
        if case[4]:  # case_number
            details_parts.append(f'案件编号: {case[4]}')
        
        if case[5]:  # keywords
            details_parts.append(f'关键词: {case[5]}')
        
        if case[6]:  # address
            details_parts.append(f'地址: {case[6]}')
        
        if case[11]:  # case_details.details
            details = self.clean_html(case[11])
            details_parts.append(f'案件详情: {details}')
        
        return '\\n'.join(details_parts)
    
    def run(self):
        try:
            cases = self.db_service.get_cases_to_process()
            print(f'Found {len(cases)} cases to process')
            
            for i, case in enumerate(cases):
                case_id = case[0]
                print(f'Processing case {i+1}/{len(cases)}: ID={case_id}')
                
                try:
                    details = self.get_case_details(case)
                    if not details:
                        print(f'Skipping case {case_id} - no details available')
                        continue
                    
                    summaries = self.gemini_service.generateMultiLangSummary(details)
                    
                    for summary in summaries:
                        self.db_service.save_summary(case_id, summary['lang'], summary['summary'])
                        print(f'Saved {summary["lang"]} summary for case {case_id}')
                        
                    print(f'Successfully processed case {case_id}')
                except Exception as e:
                    print(f'Error processing case {case_id}: {e}')
                    continue
                    
        finally:
            self.db_service.close()
            print('Database connection closed')
"""))

# 添加代码单元格：运行任务
nb.cells.append(nbf.v4.new_code_cell("""
# Run the task
if __name__ == '__main__':
    runner = GeminiSummaryRunner()
    runner.run()
"""))

# 保存notebook文件
with open('/Users/Banner/Documents/temp-seo-fix/test.ipynb', 'w', encoding='utf-8') as f:
    nbf.write(nb, f)

print('test.ipynb file generated successfully with nbformat!')
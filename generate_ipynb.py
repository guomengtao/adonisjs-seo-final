import json

# 创建一个简单的Jupyter Notebook文件
notebook = {
    "cells": [
        {
            "cell_type": "markdown",
            "metadata": {},
            "source": ["# Gemini Summary Task\n", "\n", "This notebook implements the same functionality as the `node ace gemini:summary` command."]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "import os\n",
                "import sys\n",
                "import re\n",
                "import json\n",
                "import requests\n",
                "import psycopg2\n",
                "from dotenv import load_dotenv\n",
                "\n",
                "# Load environment variables\n",
                "load_dotenv()"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "class GeminiService:\n",
                "    def __init__(self):\n",
                "        self.api_key = os.getenv('GEMINI_API_KEY', '')\n",
                "        self.base_url = 'https://chatgpt-proxy.guomengtao.workers.dev'\n",
                "        self.available_models = [\n",
                "            'models/gemini-1.5-flash-latest',\n",
                "            'models/gemini-1.5-pro-latest',\n",
                "            'models/gemini-1.0-pro-latest'\n",
                "        ]\n",
                "    \n",
                "    def generateMultiLangSummary(self, details, max_retries=3):\n",
                "        for i in range(max_retries):\n",
                "            model_index = i % len(self.available_models)\n",
                "            model_name = self.available_models[model_index]\n",
                "            \n",
                "            try:\n",
                "                # Prepare prompt\n",
                "                prompt = f'你是一位精通中文、英语、西班牙语的国际寻人专家和多语言 SEO 资深编辑。请分析以下失踪详情：\n{details}\n\n任务：为该案件生成中、英、西三语的 SEO 摘要（Summary）。\n\n输出格式要求（必须是合法 JSON，严禁任何额外解释）：\nJSON\n[\n  {\n    \"lang\": \"zh\",\n    \"summary\": \"（150-300字的中文摘要。结构：姓名+时间+地点；核心体貌/衣着特征；呼吁行动。）\"\n  },\n  {\n    \"lang\": \"en\",\n    \"summary\": \"（150-300 words English summary. Professional, native tone, no robotic translation.）\"\n  },\n  {\n    \"lang\": \"es\",\n    \"summary\": \"（Resumen en español de 150-300 palabras. Estilo natural y urgente para búsqueda de personas.）\"\n  }\n]\n\n字段约束准则（严格遵守数据库 NOT NULL 约束）：\nlang: 必须且只能是 zh, en, es 中的一个。\nsummary: 严禁为空。如果原文信息极少，请根据已知碎片信息进行合理扩充描述。\n\n内容策略:\n英文摘要需符合母语习惯（使用 \"Last seen wearing\", \"Anyone with information\" 等）。\n西语摘要需地道（使用 \"Visto por última vez\", \"Se solicita colaboración\" 等）。\n语言风格需庄重、客观，禁止使用感叹号。'\n",
                "                \n",
                "                # Send request to proxy\n",
                "                url = f'{self.base_url}/v1beta/models/{model_name.replace(\"models/\", \"")}:generateContent'\n",
                "                response = requests.post(\n",
                "                    url,\n                "                    json={\n                "                        'contents': [\n                "                            {\n                "                                'parts': [{'text': prompt}]\n                "                            }\n                "                        ]\n                "                    },\n                "                    params={'key': self.api_key}\n                "                )\n                "                response.raise_for_status()\n                "                \n                "                # Parse response\n                "                data = response.json()\n                "                text = data['candidates'][0]['content']['parts'][0]['text']\n                "                \n                "                # Clean and validate JSON\n                "                text = re.sub(r'^.*?\[', '[', text, flags=re.DOTALL)\n                "                text = re.sub(r'\].*?$', ']', text, flags=re.DOTALL)\n                "                summaries = json.loads(text)\n                "                \n                "                # Validate output\n                "                valid_langs = {'zh', 'en', 'es'}\n                "                if len(summaries) != 3:\n                "                    raise ValueError('Expected 3 summaries')\n                "                \n                "                for summary in summaries:\n                "                    if summary['lang'] not in valid_langs:\n                "                        raise ValueError(f'Invalid language: {summary["lang"]}')\n                "                    if not summary['summary']:\n                "                        raise ValueError('Empty summary')\n                "                \n                "                return summaries\n                "            except Exception as e:\n                "                print(f'Model {model_name} failed: {e}')\n                "                if i == max_retries - 1:\n                "                    raise\n                "                print(f'Retrying with model {self.available_models[(i+1) % len(self.available_models)]}...')"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "class DatabaseService:\n",
                "    def __init__(self):\n",
                "        self.conn = psycopg2.connect(\n",
                "            dbname=os.getenv('PG_DB_NAME'),\n",
                "            user=os.getenv('PG_USER'),\n",
                "            password=os.getenv('PG_PASSWORD'),\n",
                "            host=os.getenv('PG_HOST'),\n",
                "            port=os.getenv('PG_PORT', '5432')\n",
                "        )\n",
                "        self.cursor = self.conn.cursor()\n",
                "    \n",
                "    def get_cases_to_process(self):\n",
                "        self.cursor.execute("""\n",
                "            SELECT \n",
                "                c.id, c.title, c.description, c.content, c.case_number, c.keywords, c.address,\n",
                "                c.district_id, c.city_id, c.province_id, c.country_id,\n",
                "                cd.details \n",
                "            FROM cases c\n",
                "            LEFT JOIN case_details cd ON c.id = cd.case_id\n",
                "            LEFT JOIN case_summaries cs ON c.id = cs.case_id\n",
                "            WHERE c.status = 'published'\n",
                "            AND (cs.id IS NULL OR cs.updated_at < c.updated_at)\n",
                "            ORDER BY c.created_at DESC\n",
                "        """)\n",
                "        return self.cursor.fetchall()\n",
                "    \n",
                "    def save_summary(self, case_id, lang, summary):\n",
                "        self.cursor.execute("""\n",
                "            INSERT INTO case_summaries (case_id, lang, summary, created_at, updated_at)\n",
                "            VALUES (%s, %s, %s, NOW(), NOW())\n",
                "            ON CONFLICT (case_id, lang)\n",
                "            DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()\n",
                "        """, (case_id, lang, summary))\n",
                "        self.conn.commit()\n",
                "    \n",
                "    def close(self):\n",
                "        self.cursor.close()\n",
                "        self.conn.close()"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "class GeminiSummaryRunner:\n",
                "    def __init__(self):\n",
                "        self.gemini_service = GeminiService()\n",
                "        self.db_service = DatabaseService()\n",
                "    \n",
                "    def clean_html(self, html):\n",
                "        if not html:\n",
                "            return ''\n",
                "        text = re.sub(r'<[^>]+>', '', html)\n",
                "        text = re.sub(r'\s+', ' ', text).strip()\n",
                "        return text\n",
                "    \n",
                "    def get_case_details(self, case):\n",
                "        details_parts = []\n",
                "        \n",
                "        if case[1]:  # title\n",
                "            details_parts.append(f'标题: {case[1]}')\n",
                "        \n",
                "        if case[2]:  # description\n",
                "            details_parts.append(f'描述: {case[2]}')\n",
                "        \n",
                "        if case[3]:  # content\n",
                "            content = self.clean_html(case[3])\n",
                "            details_parts.append(f'详细内容: {content}')\n",
                "        \n",
                "        if case[4]:  # case_number\n",
                "            details_parts.append(f'案件编号: {case[4]}')\n",
                "        \n",
                "        if case[5]:  # keywords\n",
                "            details_parts.append(f'关键词: {case[5]}')\n",
                "        \n",
                "        if case[6]:  # address\n",
                "            details_parts.append(f'地址: {case[6]}')\n",
                "        \n",
                "        if case[11]:  # case_details.details\n",
                "            details = self.clean_html(case[11])\n",
                "            details_parts.append(f'案件详情: {details}')\n",
                "        \n",
                "        return '\n'.join(details_parts)\n",
                "    \n",
                "    def run(self):\n",
                "        try:\n",
                "            cases = self.db_service.get_cases_to_process()\n",
                "            print(f'Found {len(cases)} cases to process')\n",
                "            \n",
                "            for i, case in enumerate(cases):\n",
                "                case_id = case[0]\n",
                "                print(f'Processing case {i+1}/{len(cases)}: ID={case_id}')\n",
                "                \n",
                "                try:\n",
                "                    details = self.get_case_details(case)\n",
                "                    if not details:\n",
                "                        print(f'Skipping case {case_id} - no details available')\n",
                "                        continue\n",
                "                    \n",
                "                    summaries = self.gemini_service.generateMultiLangSummary(details)\n",
                "                    \n",
                "                    for summary in summaries:\n",
                "                        self.db_service.save_summary(case_id, summary['lang'], summary['summary'])\n",
                "                        print(f'Saved {summary["lang"]} summary for case {case_id}')\n",
                "                        \n",
                "                    print(f'Successfully processed case {case_id}')\n",
                "                except Exception as e:\n",
                "                    print(f'Error processing case {case_id}: {e}')\n",
                "                    continue\n",
                "                    \n",
                "        finally:\n",
                "            self.db_service.close()\n",
                "            print('Database connection closed')"
            ]
        },
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# Run the task\n",
                "if __name__ == '__main__':\n",
                "    runner = GeminiSummaryRunner()\n",
                "    runner.run()"
            ]
        }
    ],
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "codemirror_mode": {
                "name": "ipython",
                "version": 3
            },
            "file_extension": ".py",
            "mimetype": "text/x-python",
            "name": "python",
            "nbconvert_exporter": "python",
            "pygments_lexer": "ipython3",
            "version": "3.8.5"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 4
}

# 写入文件
with open('/Users/Banner/Documents/temp-seo-fix/test.ipynb', 'w', encoding='utf-8') as f:
    json.dump(notebook, f, ensure_ascii=False, indent=2)

print('test.ipynb file generated successfully!')
import os
from huggingface_hub import HfApi
from dotenv import load_dotenv

# 加载.env文件中的环境变量
load_dotenv()

# 配置
repo_id = "mengtaoguo/missing-persons-space"
token = os.getenv("HF_TOKEN")  # 从.env文件中读取HF_TOKEN

# 验证必要的配置
if not token:
    raise ValueError("HF_TOKEN not found in .env file")

api = HfApi(token=token)

# 从.env文件读取所有环境变量
env_vars = {}
with open('.env', 'r') as f:
    for line in f:
        line = line.strip()
        # 跳过注释和空行
        if line and not line.startswith('#'):
            # 分割键值对
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                # 处理带引号的值
                if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                env_vars[key] = value

# 同步所有环境变量到Hugging Face Space
print(f"开始同步 {len(env_vars)} 个环境变量到 {repo_id}")
print("=" * 60)

success_count = 0
failure_count = 0

for key, value in env_vars.items():
    try:
        api.add_space_secret(repo_id=repo_id, key=key, value=value)
        print(f"✅ {key} 已同步")
        success_count += 1
    except Exception as e:
        print(f"❌ {key} 同步失败: {str(e)}")
        failure_count += 1

print("=" * 60)
print(f"同步完成: {success_count} 成功, {failure_count} 失败")
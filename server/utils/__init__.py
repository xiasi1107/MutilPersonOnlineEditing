# Utils package
# 从父级 utils.py 导入函数以保持向后兼容
import sys
import os
import importlib.util

# 获取父目录的 utils.py 文件路径
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
utils_py_path = os.path.join(parent_dir, 'utils.py')

# 动态导入 utils.py 模块
spec = importlib.util.spec_from_file_location("utils_module", utils_py_path)
utils_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(utils_module)

# 导出函数
decode_access_token = utils_module.decode_access_token
create_access_token = utils_module.create_access_token
get_password_hash = utils_module.get_password_hash
verify_password = utils_module.verify_password

__all__ = [
    'decode_access_token',
    'create_access_token',
    'get_password_hash',
    'verify_password'
]


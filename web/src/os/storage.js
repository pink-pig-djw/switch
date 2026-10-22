// 本地存储（localStorage 在隐私模式 / 预览环境里可能抛异常，所以全部 try/catch，失败就退回内存）
const PREFIX = 'teaos.';
const memory = new Map();

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) {
      if (memory.has(key)) return memory.get(key);
    }
    return memory.has(key) ? memory.get(key) : fallback;
  },
  set(key, value) {
    memory.set(key, value);
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // 忽略：只保存在内存里
    }
  },
};

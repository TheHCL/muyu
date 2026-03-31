'use strict';

const adjectives = [
  '慈悲', '虔誠', '安靜', '清淨', '善良', '溫柔', '智慧', '慈祥',
  '寧靜', '祥和', '悲憫', '歡喜', '自在', '圓滿', '無憂', '光明',
  '純淨', '正直', '廣大', '無量',
];

const nouns = [
  '蓮花', '鐘聲', '菩薩', '佛光', '禪心', '法師', '香客', '信徒',
  '修行者', '行者', '居士', '善信', '佛子', '天龍', '羅漢', '護法',
  '金剛', '普賢', '文殊', '觀音',
];

function generate() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}的${noun}`;
}

const MAX_LEN = 20;

function sanitize(nick) {
  if (typeof nick !== 'string') return null;
  nick = nick.replace(/[<>&"']/g, '').trim();
  if (nick.length === 0 || nick.length > MAX_LEN) return null;
  return nick;
}

module.exports = { generate, sanitize };

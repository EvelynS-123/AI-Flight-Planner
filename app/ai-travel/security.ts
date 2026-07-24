export type TravelRevisionCheck =
  | { allowed: true; value: string }
  | { allowed: false; reason: "too-long" | "prompt-injection" | "out-of-scope" };

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|system|developer)\s+(instructions?|messages?|prompts?)/i,
  /(reveal|repeat|print|show|leak)\s+(the\s+)?(system|developer|hidden)\s+(prompt|message|instructions?)/i,
  /(api[-\s]?key|access[-\s]?token|secret|credentials?|jailbreak|developer\s+mode|system\s+prompt)/i,
  /(roleplay|pretend|act)\s+as\s+(a|an|the)?\s*(system|developer|admin)/i,
  /(disregard|override|bypass|forget)\b.{0,40}\b(instructions?|prompts?|rules?|safeguards?|polic(?:y|ies))/i,
  /(output|return|expose|dump|translate|summarize)\b.{0,35}\b(hidden|internal|initial|highest[-\s]?priority)\b.{0,20}\b(instructions?|prompts?|messages?)/i,
  /(base64|rot13).{0,24}(decode|execute|instruction|prompt)|(decode|execute).{0,24}(base64|rot13)/i,
  /\b(begin|start)\s+(system|developer|assistant)\s+(message|prompt|instructions?)/i,
  /<\s*\/?\s*(system|developer|assistant|tool)\s*>/i,
  /忽略.{0,12}(之前|以上|系统|开发者).{0,8}(指令|提示|消息)/i,
  /(系统提示词|开发者消息|隐藏指令|越狱|密钥|令牌|泄露提示词)/i,
  /(无视|跳过|绕过|覆盖|忘掉).{0,18}(规则|限制|指令|提示|安全策略)/i,
  /(输出|显示|复述|翻译|总结).{0,18}(内部|最高优先级|初始|隐藏).{0,12}(指令|消息|提示)/i,
  /(base64|编码).{0,12}(解码|执行|指令|提示)/i,
  /(이전|시스템|개발자).{0,12}(지시|프롬프트).{0,8}(무시|공개)/i,
  /(무시|우회|덮어쓰기).{0,16}(규칙|지시|프롬프트|보안)/i,
  /(출력|공개|번역).{0,16}(내부|숨겨진|최우선).{0,12}(지시|프롬프트|메시지)/i,
  /(システム|開発者|以前).{0,12}(指示|プロンプト).{0,8}(無視|公開)/i,
  /(無視|回避|上書き).{0,16}(規則|指示|プロンプト|安全)/i,
  /(出力|公開|翻訳).{0,16}(内部|隠された|最優先).{0,12}(指示|プロンプト|メッセージ)/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /(write|create|generate|provide|help with).{0,24}(code|script|malware|ransomware|phishing|essay|email|contract|diagnosis|stock picks?)/i,
  /(code|script|malware|ransomware|phishing|essay|email|contract|diagnosis|stock picks?).{0,24}(write|create|generate|provide)/i,
  /(写|生成|提供|制作).{0,16}(代码|脚本|木马|勒索软件|钓鱼邮件|论文|作业|合同|诊断|股票推荐)/i,
  /(代码|脚本|木马|勒索软件|钓鱼邮件|论文|作业|合同|诊断|股票推荐).{0,16}(写|生成|提供|制作)/i,
  /(작성|생성|제공).{0,16}(코드|스크립트|악성코드|피싱|논문|이메일|계약서|진단|주식 추천)/i,
  /(코드|스크립트|악성코드|피싱|논문|이메일|계약서|진단|주식 추천).{0,20}(작성|생성|제공)/i,
  /(作成|生成|提供).{0,16}(コード|スクリプト|マルウェア|フィッシング|論文|メール|契約書|診断|株式推奨)/i,
  /(コード|スクリプト|マルウェア|フィッシング|論文|メール|契約書|診断|株式推奨).{0,20}(作成|生成|提供)/i,
];

const TRAVEL_SCOPE_PATTERNS = [
  /(flight|airport|arrival|departure|layover|stopover|transit|immigration|customs|baggage|hotel|restaurant|food|meal|eat|eating|drink|dining|cuisine|ramen|tempura|udon|sushi|vegetarian|vegan|allerg(?:y|ic)|gluten|seafood|attraction|museum|beach|walk|traffic|train|taxi|bus|buffer|schedule|pace|relax|tight|rush|city|trip|itinerary|visit)/i,
  /(航班|机场|抵达|到达|出发|离开|中转|转机|入境|海关|行李|住宿|酒店|餐厅|吃|美食|拉面|寿司|天妇罗|素食|纯素|过敏|忌口|景点|博物馆|海滩|散步|交通|地铁|火车|出租车|巴士|预留|行程|节奏|宽松|适中|紧凑|紧张|赶|城市|游玩|逛|休息)/i,
  /(항공|공항|도착|출발|환승|입국|세관|수하물|호텔|숙소|식당|음식|먹|마시|싫|알레르기|채식|관광|박물관|해변|산책|교통|기차|택시|버스|여유|일정|여행|도시)/i,
  /(フライト|空港|到着|出発|乗り継ぎ|入国|税関|手荷物|ホテル|レストラン|食事|食べ|飲み|苦手|アレルギー|避け|観光|博物館|海|散歩|交通|電車|タクシー|バス|余裕|旅程|旅行|都市)/i,
];

export function checkTravelRevision(value: unknown): TravelRevisionCheck {
  if (typeof value !== "string") return { allowed: false, reason: "out-of-scope" };
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return { allowed: false, reason: "out-of-scope" };
  if (normalized.length > 500) return { allowed: false, reason: "too-long" };
  const compact = normalized.replace(/[\s._-]+/g, "").toLowerCase();
  if ([
    "systemprompt",
    "developerinstructions",
    "hiddenprompt",
    "ignorepreviousinstructions",
    "apikey",
    "accesstoken",
    "系统提示词",
    "隐藏指令",
    "시스템프롬프트",
    "システムプロンプト",
  ].some((token) => compact.includes(token))) {
    return { allowed: false, reason: "prompt-injection" };
  }
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, reason: "prompt-injection" };
  }
  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, reason: "out-of-scope" };
  }
  if (!TRAVEL_SCOPE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, reason: "out-of-scope" };
  }
  return { allowed: true, value: normalized };
}

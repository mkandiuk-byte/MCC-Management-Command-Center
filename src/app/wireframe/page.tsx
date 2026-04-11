"use client"

export default function WireframePage() {
  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#0B0D14", color: "#E2E8F8" }}>

      {/* Sidebar */}
      <div className="w-[220px] shrink-0 border-r border-white/5 p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-4">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#5B6BF5] to-[#A87EF5] flex items-center justify-center text-[14px] font-extrabold text-white">M</div>
          <span className="text-[15px] font-bold">MCC</span>
        </div>
        {["📊 Головна", "📈 Медіабаїнг", "⚙️ Продукт і Розробка", "🔄 Процеси", "📉 Аналітика", "⚠️ Проблеми"].map((item, i) => (
          <div key={i} className={`px-3.5 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer ${i === 0 ? "text-[#6C7BF5] bg-[rgba(108,123,245,0.08)] border-l-[3px] border-[#6C7BF5]" : "text-[#6B7A94] border-l-[3px] border-transparent hover:bg-white/[0.03]"}`}>{item}</div>
        ))}
        <div className="flex-1" />
        <div className="px-3.5 py-2.5 text-[13px] text-[#4A5568]">🌙 Тема · UA | EN</div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-8 max-w-[1200px]">

        {/* Header */}
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">Контрольна Вежа</h1>
            <p className="text-[13px] text-[#6B7A94] mt-1">Усі відділи · оперативна аналітика</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white/[0.04] rounded-lg p-0.5">
              {["7д", "14д", "30д", "90д"].map((p, i) => (
                <div key={i} className={`px-3.5 py-1.5 text-[12px] font-semibold rounded-md cursor-pointer ${i === 2 ? "bg-[#6C7BF5] text-white" : "text-[#6B7A94]"}`}>{p}</div>
              ))}
            </div>
            <span className="text-[11px] text-[#4A5568]">2хв тому</span>
          </div>
        </div>

        {/* S1: INSIGHTS */}
        <div className="mb-8">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4A5568] mb-3">⚡ Що потребує уваги</div>
          <div className="bg-[rgba(18,21,32,0.8)] border border-white/[0.06] border-l-[3px] border-l-[#6C7BF5] rounded-2xl p-5 backdrop-blur-xl">
            {[
              { icon: "🔴", text: "3 групи баєрів із сигналом STOP (ROI < -30%). BR, ES, PL спалюють $33К/міс." },
              { icon: "🔴", text: "Швидкість спринту впала з 75% до 27%. Перевірте зміну обсягу задач." },
              { icon: "🟡", text: "Олег Литвин: 13 задач (було 10). Вузьке місце зростає." },
              { icon: "🟢", text: "6 груп баєрів прибуткові — $309К прибутку за 30 днів." },
            ].map((r, i) => (
              <div key={i} className="flex gap-2.5 py-1.5 text-[13px] leading-relaxed text-[#B0B8D0]">
                <span className="text-[14px] mt-0.5 shrink-0">{r.icon}</span>
                <span>{r.text}</span>
              </div>
            ))}
            <div className="bg-[rgba(108,123,245,0.06)] border border-[rgba(108,123,245,0.15)] rounded-xl px-4 py-3 mt-3 text-[12px] text-[#8B9FF5]">
              <strong className="text-[#6C7BF5]">💡 Рекомендація:</strong> Розгляньте паузу кампаній DE (ROI -17%). Орієнтовна економія: ~$70К/місяць.
            </div>
          </div>
        </div>

        {/* S2: FINANCIAL */}
        <div className="mb-8">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4A5568] mb-3">💰 Фінанси</div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Витрати", value: "$3.1M", color: "text-[#E2E8F8]", sub: "↑12%", subC: "text-[#52C67E]" },
              { label: "Дохід", value: "$3.4M", color: "text-[#E2E8F8]", sub: "↑8%", subC: "text-[#52C67E]" },
              { label: "Прибуток", value: "$309К", color: "text-[#52C67E]", sub: "↑24%", subC: "text-[#52C67E]" },
              { label: "ROI", value: "10%", color: "text-[#F5A623]", sub: "↓3% · ціль 15%", subC: "text-[#F55D5D]" },
            ].map((m, i) => (
              <div key={i} className="bg-[rgba(18,21,32,0.6)] border border-white/[0.06] rounded-[14px] p-5 cursor-pointer hover:border-white/[0.12] transition-all">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A94] mb-2">{m.label}</div>
                <div className={`text-[28px] font-extrabold tracking-tight leading-none ${m.color}`}>{m.value}</div>
                <div className={`text-[11px] mt-1.5 ${m.subC}`}>{m.sub} vs попередні</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1.5fr_1fr] gap-3 mt-3">
            <div className="bg-[rgba(18,21,32,0.6)] border border-white/[0.06] rounded-[14px] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A94] mb-3">Топ гео за прибутком</div>
              {[
                { name: "🇨🇦 Канада", profit: "+$237К", roi: "35%", c: "#52C67E" },
                { name: "🇬🇧 Великобританія", profit: "+$191К", roi: "16%", c: "#52C67E" },
                { name: "🇦🇺 Австралія", profit: "+$23К", roi: "6%", c: "#F5A623" },
                { name: "🇩🇪 Німеччина", profit: "-$70К", roi: "-17%", c: "#F55D5D" },
              ].map((g, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/[0.03] last:border-0 text-[13px] cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
                  <span className="font-semibold">{g.name}</span>
                  <span className="font-bold text-[14px]" style={{ color: g.c }}>{g.profit}</span>
                  <span className="text-[12px] text-[#6B7A94] min-w-[55px] text-right">ROI {g.roi}</span>
                </div>
              ))}
            </div>
            <div className="bg-[rgba(245,93,93,0.04)] border border-[rgba(245,93,93,0.1)] rounded-[14px] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#F55D5D] mb-3">🔴 STOP сигнали</div>
              {[{ n: "BR | FB", l: "-$19К" }, { n: "ES | FB", l: "-$8К" }, { n: "PL | FB", l: "-$6К" }].map((s, i) => (
                <div key={i} className="flex justify-between py-1.5 text-[13px] text-[#F55D5D]"><span>{s.n}</span><span>{s.l}</span></div>
              ))}
              <div className="mt-2 pt-2 border-t border-[rgba(245,93,93,0.1)] text-[12px] font-bold text-[#F55D5D]">Щомісячні втрати: $33К</div>
            </div>
          </div>
        </div>

        {/* S3: ENGINEERING */}
        <div className="mb-8">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4A5568] mb-3">⚙️ Розробка</div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Швидкість", value: "27%", color: "text-[#F55D5D]", sub: "середнє 75%" },
              { label: "Баги", value: "40%", color: "text-[#F55D5D]", sub: "ціль <20%" },
              { label: "Заблоковано", value: "12", color: "text-[#F5A623]", sub: "7 від Олега Литвина" },
              { label: "QA черга", value: "5", color: "text-[#F5A623]", sub: "Тимофій (соло)" },
            ].map((m, i) => (
              <div key={i} className="bg-[rgba(18,21,32,0.6)] border border-white/[0.06] rounded-[14px] p-5 cursor-pointer hover:border-white/[0.12] transition-all">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A94] mb-2">{m.label}</div>
                <div className={`text-[28px] font-extrabold tracking-tight leading-none ${m.color}`}>{m.value}</div>
                <div className="text-[11px] text-[#4A5568] mt-1.5">{m.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[1.5fr_1fr] gap-3 mt-3">
            <div className="bg-[rgba(18,21,32,0.6)] border border-white/[0.06] rounded-[14px] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A94] mb-3">Прогрес спринту</div>
              {[
                { team: "ASD · MB AP 20", pct: 40, color: "#F55D5D" },
                { team: "FS · MB FS 05", pct: 14, color: "#F5A623" },
              ].map((s, i) => (
                <div key={i} className="mb-2.5">
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-[#B0B8D0]">{s.team}</span>
                    <span className="font-bold" style={{ color: s.color }}>{s.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[rgba(18,21,32,0.6)] border border-white/[0.06] rounded-[14px] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7A94] mb-3">Вузькі місця</div>
              {[
                { ini: "ОЛ", name: "Олег Литвин", n: 13, pct: 100, c: "#F55D5D" },
                { ini: "ОП", name: "Олег Петров", n: 9, pct: 69, c: "#F5A623" },
                { ini: "ЯК", name: "Ярослав Куц", n: 8, pct: 62, c: "#F5A623" },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5 text-[13px]">
                  <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold">{b.ini}</div>
                  <span className="min-w-[100px] text-[12px] text-[#B0B8D0]">{b.name}</span>
                  <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.c }} />
                  </div>
                  <span className="font-bold text-[14px] min-w-[30px] text-right" style={{ color: b.c }}>{b.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* S4: PROBLEMS */}
        <div className="mb-8">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4A5568] mb-3">🔧 Активні проблеми</div>
          <div className="flex gap-2 flex-wrap">
            {[
              { name: "🔒 Клоакінг", status: "тестування", sc: "#F55D5D", bc: "rgba(245,93,93,0.2)" },
              { name: "📄 Вайт-пейджі", status: "дослідження", sc: "#F5A623", bc: "rgba(245,166,35,0.2)" },
              { name: "💀 WebRTC", status: "тестування", sc: "#F5A623", bc: "rgba(245,166,35,0.2)" },
              { name: "📱 iOS", status: "QA аудит", sc: "#6B7A94", bc: "rgba(255,255,255,0.06)" },
              { name: "🔗 SSAPI", status: "заплановано", sc: "#6B7A94", bc: "rgba(255,255,255,0.06)" },
              { name: "🔄 Міграція", status: "42%", sc: "#52C67E", bc: "rgba(82,198,126,0.2)" },
            ].map((p, i) => (
              <div key={i} className="px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[rgba(18,21,32,0.6)] cursor-pointer text-center min-w-[100px] hover:bg-[rgba(18,21,32,0.8)] transition-all" style={{ border: `1px solid ${p.bc}` }}>
                <div className="mb-1">{p.name}</div>
                <div className="text-[10px] font-medium" style={{ color: p.sc }}>● {p.status}</div>
              </div>
            ))}
          </div>
        </div>

        {/* S5: INFRA */}
        <div className="mb-8">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4A5568] mb-3">🏗️ Інфраструктура</div>
          <div className="flex gap-6 px-5 py-4 bg-[rgba(18,21,32,0.4)] border border-white/[0.04] rounded-xl text-[13px]">
            {[
              { l: "Задач", v: "27" }, { l: "В роботі", v: "5" }, { l: "Сервісів", v: "65" },
              { l: "Прострочено", v: "0", c: "#52C67E" }, { l: "Людей", v: "328" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[#6B7A94]">{item.l}:</span>
                <span className="font-bold" style={{ color: item.c || "#E2E8F8" }}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-10 text-[12px] text-[#4A5568] border-t border-white/[0.04] mt-5">
          WIREFRAME · MCC Control Tower · Дані з Keitaro + Jira + Airtable<br />
          Натисніть метрику → деталізація · Натисніть проблему → статус тестування
        </div>
      </div>
    </div>
  )
}

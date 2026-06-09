import React, { useState } from "react";

const TutorialPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const tutorialCards = [
    {
      id: 1,
      label: "Namaste / Hello",
      regional: ["नमस्ते", "வணக்கம்", "নমস্কার"],
      tip: "Keep fingers together and smile respectfully.",
    },
    {
      id: 2,
      label: "Water",
      regional: ["पानी", "தண்ணீர்", "জল"],
      tip: "Move your hand gently toward your mouth.",
    },
    {
      id: 3,
      label: "Thank You",
      regional: ["धन्यवाद", "நன்றி", "ধন্যবাদ"],
      tip: "Move your hand outward from your chin.",
    },
    {
      id: 4,
      label: "Help",
      regional: ["मदद", "உதவி", "সাহায্য"],
      tip: "Raise one hand while supporting it with the other.",
    },
    {
      id: 5,
      label: "Food / Hungry",
      regional: ["खाना", "உணவு", "খাবার"],
      tip: "Touch fingertips together and move toward lips.",
    },
    {
      id: 6,
      label: "Emergency",
      regional: ["आपातकाल", "அவசரம்", "জরুরি"],
      tip: "Wave your hand quickly to attract attention.",
    },
  ];

  const filteredCards = tutorialCards.filter((card) =>
    card.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070B1A] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* HERO SECTION */}
        <div className="grid lg:grid-cols-3 gap-8 items-start mb-12">

          {/* LEFT */}
          <div className="lg:col-span-2">
            <p className="text-emerald-400 text-sm font-semibold mb-3">
              INTERACTIVE LEARNING CENTER
            </p>

            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Learn Common Signs in 5 Minutes
            </h1>

            <p className="text-gray-400 text-lg max-w-2xl">
              Learn daily-use Indian Sign Language gestures with
              multilingual translations and interactive learning cards.
            </p>
          </div>

          {/* SEARCH BOX */}
          <div className="bg-[#0D1326] border border-slate-800 rounded-2xl p-6">
            <p className="text-xs text-gray-400 font-semibold mb-4">
              SEARCH SIGN DICTIONARY
            </p>

            <div className="relative">
              <input
                type="text"
                placeholder="Search 'water', 'hello', 'food'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-emerald-400"
              />

              <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-400 text-black px-4 py-2 rounded-lg font-semibold hover:bg-emerald-300 transition">
                Search
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Search from 100+ signs
            </p>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="grid lg:grid-cols-4 gap-8">

          {/* LEFT SIDEBAR */}
          <div className="space-y-6">

            {/* TUTORIAL */}
            <div className="bg-[#0D1326] border border-slate-800 rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-5">
                How to show signs clearly
              </h2>

              <div className="aspect-video bg-slate-700 rounded-2xl mb-6 flex items-center justify-center">
                <span className="text-5xl">▶</span>
              </div>

              <div className="space-y-5">

                <div className="flex gap-3">
                  <span className="text-emerald-400 text-xl">✓</span>

                  <div>
                    <h4 className="font-semibold text-emerald-400">
                      Good Lighting
                    </h4>

                    <p className="text-sm text-gray-400">
                      Ensure light is in front of you.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-emerald-400 text-xl">✓</span>

                  <div>
                    <h4 className="font-semibold text-emerald-400">
                      Clear Hand Position
                    </h4>

                    <p className="text-sm text-gray-400">
                      Keep gestures visible at chest level.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="text-emerald-400 text-xl">✓</span>

                  <div>
                    <h4 className="font-semibold text-emerald-400">
                      Slow Motion
                    </h4>

                    <p className="text-sm text-gray-400">
                      Hold gestures for 2 seconds.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* QUIZ */}
            <div className="bg-[#16101A] border border-orange-900 rounded-2xl p-6">
              <p className="text-orange-400 text-xs font-bold mb-2">
                QUICK QUIZ
              </p>

              <h3 className="text-2xl font-bold mb-5">
                Guess the sign below
              </h3>

              <div className="aspect-video bg-slate-700 rounded-2xl mb-5"></div>

              <p className="text-gray-400 mb-5">
                What does this gesture mean?
              </p>

              <div className="space-y-3">

                <button className="w-full border border-slate-700 rounded-xl py-3 hover:border-emerald-400 transition">
                  A. Water
                </button>

                <button className="w-full border border-emerald-400 bg-emerald-400/10 text-emerald-400 rounded-xl py-3">
                  B. Home ✓
                </button>

              </div>
            </div>
          </div>

          {/* RIGHT SECTION */}
          <div className="lg:col-span-3">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold">
                Common Daily Phrases Dictionary
              </h2>

              <p className="text-gray-500 text-sm">
                Showing {filteredCards.length} gestures
              </p>
            </div>

            {/* CARDS */}
            <div className="grid md:grid-cols-2 gap-6">

              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="bg-[#0D1326] border border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-400 transition"
                >

                  {/* IMAGE */}
                  <div className="aspect-video bg-slate-700"></div>

                  {/* CONTENT */}
                  <div className="p-5">

                    {/* TITLE */}
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-xl font-bold">
                        {card.label}
                      </h3>

                      <span className="text-xs bg-emerald-400/10 text-emerald-400 px-3 py-1 rounded-full">
                        High
                      </span>
                    </div>

                    {/* TRANSLATIONS */}
                    <div className="bg-[#111827] rounded-xl p-4 mb-5">
                      <h4 className="text-sm text-gray-400 mb-4">
                        Regional Language Translation
                      </h4>

                      <div className="grid grid-cols-3 gap-3 text-center">

                        {card.regional.map((lang, index) => (
                          <div
                            key={index}
                            className="bg-slate-900 rounded-lg p-2 text-sm"
                          >
                            {lang}
                          </div>
                        ))}

                      </div>
                    </div>

                    {/* TIP */}
                    <div className="bg-slate-900 rounded-xl p-4 mb-5">
                      <p className="text-sm text-gray-300">
                         {card.tip}
                      </p>
                    </div>

                    {/* FOOTER */}
                    <div className="flex items-center justify-between">

                      <span className="text-emerald-400 text-sm font-medium">
                        Recognition: High
                      </span>

                      <button className="bg-emerald-400/10 text-emerald-400 px-4 py-2 rounded-lg text-sm hover:bg-emerald-400 hover:text-black transition">
                        Practice Live →
                      </button>

                    </div>

                  </div>
                </div>
              ))}

            </div>

            {/* EMPTY STATE */}
            {filteredCards.length === 0 && (
              <div className="text-center py-20">
                <h3 className="text-3xl font-bold mb-3">
                  No Sign Found
                </h3>

                <p className="text-gray-400">
                  Try searching another keyword.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialPage;
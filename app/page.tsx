'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useSpring, useInView, AnimatePresence } from 'framer-motion';
import {
  Calendar, QrCode, Bell, Users, BarChart3, CheckCircle2,
  ArrowRight, Clock, MapPin, Zap, Shield
} from 'lucide-react';

const CYCLE_WORDS = [
  { word: 'create.',    color: '#6366F1' },
  { word: 'manage.',    color: '#10B981' },
  { word: 'check in.',  color: '#6366F1' },
  { word: 'notify.',    color: '#10B981' },
  { word: 'track.',     color: '#6366F1' },
  { word: 'celebrate.', color: '#10B981' },
  { word: 'go live.',   color: '#6366F1' },
  { word: 'go UNIO.',   color: '#10B981' },
];

const MOCK_EVENTS = [
  { id: 1, title: 'Spring Fest Night Market', time: '7:00 PM', location: 'Central Quad',   color: '#6366F1', rsvp: 144, cap: 200 },
  { id: 2, title: 'Founders Pitch Night',     time: '6:30 PM', location: 'Auditorium B',   color: '#10B981', rsvp: 98,  cap: 100 },
  { id: 3, title: 'AI & Society Panel',       time: '5:00 PM', location: 'Lecture Hall 3', color: '#8B5CF6', rsvp: 200, cap: 200 },
];

const FEATURES = [
  { icon: Calendar,  title: 'Create in 30s',        desc: 'Set up any event in under 30 seconds. No spreadsheets.',            stat: '30s', color: '#6366F1' },
  { icon: QrCode,    title: 'QR Check-in',           desc: 'Students scan once and walk in. Live attendance updates instantly.', stat: '3s',  color: '#10B981' },
  { icon: Bell,      title: 'Instant Notifications', desc: 'Push updates reach every student in under a second.',               stat: '<1s', color: '#6366F1' },
  { icon: Users,     title: 'Smart Waitlists',       desc: 'Spots open? Next in line is notified instantly.',                   stat: '∞',   color: '#10B981' },
  { icon: BarChart3, title: 'Post-event Analytics',  desc: 'Turnout rates and engagement scores. Reports ready in 48 hours.',   stat: '48h', color: '#6366F1' },
  { icon: Shield,    title: 'Role-based Access',     desc: 'Organizers, moderators, admins — each gets exactly what they need.', stat: '∞',  color: '#10B981' },
];

const STEPS = [
  { n: '01', title: 'Create your event',  desc: 'Fill in the name, date, venue, and capacity. Hit publish. Your event is live instantly.' },
  { n: '02', title: 'Students RSVP',      desc: 'A link goes out. Students tap, confirm, and get added. Waitlist kicks in automatically.' },
  { n: '03', title: 'Day-of check-in',    desc: 'Students show their QR code at the door. Organizers scan it. Done in 3 seconds.' },
  { n: '04', title: 'Review your impact', desc: 'After the event, see who showed up and how engaged they were.' },
];

export default function UnioLandingPage() {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <div style={{ backgroundColor: '#0F1117', color: '#ffffff', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <motion.div style={{ scaleX: smoothProgress, position: 'fixed', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(to right, #6366F1, #10B981)', transformOrigin: 'left', zIndex: 100 }} />

      <nav style={{ position: 'fixed', top: 0, width: '100%', zIndex: 50, backdropFilter: 'blur(20px)', backgroundColor: 'rgba(15,17,23,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, backgroundColor: '#6366F1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.5)' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>U</span>
            </div>
            <span style={{ fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
              UNIO <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>Campus</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Link href="/login" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, textDecoration: 'none', letterSpacing: '-0.01em' }}>Login</Link>
            <Link href="/login#signup" style={{ backgroundColor: '#6366F1', color: '#fff', padding: '8px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.35)', textDecoration: 'none', display: 'inline-block' }}>Get started →</Link>
          </div>
        </div>
      </nav>

      <WordCycleSection />
      <WhatIsUnio />
      <LiveDemo />
      <HowItWorks />
      <FeaturesGrid />
      <StatsBar />
      <FinalCTA />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WORD CYCLE SECTION
// ─────────────────────────────────────────────────────────────────
function WordCycleSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const totalWords = CYCLE_WORDS.length; // 8
  const wordFraction = totalWords / (totalWords + 1); // 8/9

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPastSection, setIsPastSection] = useState(false);
  const [isBeforeSection, setIsBeforeSection] = useState(true);

  // ── Manually track scroll progress against the container's
  //    position in the document. This is more reliable than
  //    framer-motion target-based useScroll because it works
  //    even when html/body have height constraints or when
  //    the scroll container is the window.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const sectionH = el.offsetHeight;
      const viewH = window.innerHeight;
      // scrolled = how far the top of the section is above the viewport top
      // range: [0 (not yet scrolled to), sectionH - viewH (fully scrolled through)]
      const scrolled = -rect.top;
      const rawProgress = scrolled / (sectionH - viewH);
      const clamped = Math.max(0, Math.min(1, rawProgress));
      setProgress(clamped);
      setIsBeforeSection(rect.top > 0);
      setIsPastSection(clamped >= 1);

      const wordProgress = Math.min(clamped / wordFraction, 1);
      const idx = Math.min(Math.floor(wordProgress * totalWords), totalWords - 1);
      setActiveIdx(idx);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run once on mount
    return () => window.removeEventListener('scroll', onScroll);
  }, [wordFraction, totalWords]);

  const isUnio = activeIdx === totalWords - 1;

  // Scroll transition transforms for "go UNIO." screen
  const goOpacityV   = isUnio ? Math.max(0, 1 - (progress - wordFraction) / 0.04) : 1;
  const unioScaleV   = 1 + (progress - wordFraction) / (1 - wordFraction) * 1.2;
  const unioOpacityV = isUnio
    ? Math.max(0, 1 - Math.max(0, progress - wordFraction) / (1 - wordFraction) * (1 / 0.96))
    : 1;
  const unioBlurV    = isUnio
    ? Math.max(0, (progress - wordFraction) / (1 - wordFraction)) * 10
    : 0;

  // Only show the overlay while we're inside the section
  const overlayVisible = !isBeforeSection && !isPastSection;

  return (
    <div ref={containerRef} style={{ position: 'relative', height: `${(totalWords + 1) * 100}vh`, backgroundColor: '#0F1117' }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', zIndex: 10, pointerEvents: 'none',
        opacity: overlayVisible ? 1 : 0,
        visibility: overlayVisible ? 'visible' : 'hidden',
        transition: 'opacity 0.2s ease, visibility 0.2s ease',
      }}>

        {/* Background glow */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 700, height: 400, borderRadius: '50%', background: `${CYCLE_WORDS[activeIdx].color}18`, filter: 'blur(120px)', transition: 'background 0.7s' }} />
        </div>

        {/* "your campus can" — fades with opacity, never unmounts */}
        <p style={{
          color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 24,
          position: 'relative', zIndex: 1,
          opacity: isUnio ? 0 : 1,
          transition: 'opacity 0.45s ease',
        }}>
          your campus can
        </p>

        {/* ALL words including "go UNIO." inside one AnimatePresence */}
        <div style={{
          position: 'relative', zIndex: 1,
          overflow: isUnio ? 'visible' : 'hidden',
          height: isUnio ? 'auto' : '1.15em',
          fontSize: 'clamp(3.5rem, 11vw, 8rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          lineHeight: 1.15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <AnimatePresence mode="wait">
            {activeIdx < totalWords - 1 ? (
              // Normal words 0–6
              <motion.span
                key={activeIdx}
                initial={{ y: '110%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '-110%', opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{ color: CYCLE_WORDS[activeIdx].color, display: 'block' }}
              >
                {CYCLE_WORDS[activeIdx].word}
              </motion.span>
            ) : (
              // Word 7 — "go UNIO." slides in the same way then transforms
              <motion.div
                key="go-unio"
                initial={{ y: '110%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '-110%', opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                {/* "go" — small, fades out during scroll transition */}
                <span style={{
                  fontSize: 'clamp(1.2rem, 3vw, 2rem)',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  opacity: goOpacityV,
                  display: 'block',
                  textAlign: 'center',
                  lineHeight: 1,
                }}>
                  go
                </span>

                {/* "UNIO." — enlarges and fades into background on scroll */}
                <span style={{
                  fontSize: 'clamp(4rem, 14vw, 12rem)',
                  fontWeight: 800,
                  color: '#10B981',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  display: 'block',
                  textAlign: 'center',
                  transform: `scale(${Math.max(1, unioScaleV)})`,
                  transformOrigin: 'center center',
                  opacity: Math.max(0, Math.min(1, unioOpacityV)),
                  filter: `blur(${Math.max(0, unioBlurV)}px)`,
                }}>
                  UNIO.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* "and UNIO handles the rest." — fades with opacity, never unmounts */}
        <p style={{
          color: 'rgba(255,255,255,0.35)', fontSize: 18, fontWeight: 500,
          marginTop: 24, position: 'relative', zIndex: 1,
          opacity: isUnio ? 0 : 1,
          transition: 'opacity 0.45s ease',
        }}>
          and UNIO handles the rest.
        </p>

        {/* Dot indicators — fade with opacity, never unmount */}
        <div style={{
          position: 'absolute', bottom: 36, display: 'flex', gap: 8, zIndex: 1,
          opacity: isUnio ? 0 : 1,
          transition: 'opacity 0.45s ease',
        }}>
          {CYCLE_WORDS.map((w, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 999,
              width: i === activeIdx ? 24 : 6,
              backgroundColor: i === activeIdx ? w.color : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Bottom fade */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom, transparent, #0F1117)', pointerEvents: 'none', zIndex: 2 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WHAT IS UNIO
// ─────────────────────────────────────────────────────────────────
function WhatIsUnio() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });

  return (
    <section ref={ref} style={{ padding: '120px 32px', backgroundColor: '#0F1117', position: 'relative', zIndex: 20 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}>
          <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 999, backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 32 }}>
            What is UNIO?
          </span>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 28, color: '#ffffff' }}>
            Campus event management,{' '}
            <span style={{ background: 'linear-gradient(to right, #818cf8, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              finally done right.
            </span>
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, maxWidth: 700, margin: '0 auto' }}>
            UNIO is a single platform where campus clubs create events, collect RSVPs, run QR check-ins, send live updates, and review analytics — all without touching a spreadsheet.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.2 }}
          style={{ marginTop: 56, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
          {[
            { icon: Zap,       label: 'Built for speed',    sub: 'Create events in 30 seconds' },
            { icon: Users,     label: 'Built for everyone', sub: 'Clubs, admins, students' },
            { icon: BarChart3, label: 'Built for insight',  sub: 'Real-time data, always' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '14px 22px' }}>
              <Icon size={20} color="#818cf8" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{sub}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// LIVE DEMO
// ─────────────────────────────────────────────────────────────────
function LiveDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const [activeEvent, setActiveEvent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveEvent((p) => (p + 1) % MOCK_EVENTS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const ev = MOCK_EVENTS[activeEvent];

  return (
    <section ref={ref} style={{ padding: '100px 32px', backgroundColor: '#0c0e14', position: 'relative', zIndex: 20 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 64, alignItems: 'center' }}>
        <motion.div initial={{ opacity: 0, x: -40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7 }}>
          <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.25em', display: 'block', marginBottom: 16 }}>The Product</span>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 20, color: '#ffffff' }}>
            Everything your organizers need, in one place.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, marginBottom: 28 }}>
            UNIO gives every organizer a live command center. See RSVPs fill up, watch check-ins happen in real time, send announcements with one tap.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Live RSVP counter with automatic waitlist', 'QR code check-in, 3 seconds per student', 'One-tap announcements to all attendees', 'Post-event report ready in 48 hours'].map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                <CheckCircle2 size={15} color="#10B981" style={{ flexShrink: 0 }} />{item}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 40 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.7, delay: 0.15 }} style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -24, borderRadius: 48, background: `${ev.color}14`, filter: 'blur(60px)', transition: 'background 0.5s' }} />
          <div style={{ position: 'relative', backgroundColor: '#161922', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 28, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 22, height: 22, backgroundColor: '#6366F1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>U</span></div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>UNIO Event Hub</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>{[0,1,2].map(i=><div key={i} style={{ width:10,height:10,borderRadius:'50%',backgroundColor:'rgba(255,255,255,0.1)' }}/>)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>(
                <div key={d} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 12px',borderRadius:12,flexShrink:0,fontSize:11,backgroundColor:i===2?ev.color:'rgba(255,255,255,0.04)',color:i===2?'#fff':'rgba(255,255,255,0.3)',fontWeight:i===2?700:400 }}>
                  <span>{d}</span><span style={{fontWeight:700}}>{12+i}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '18px 22px' }}>
              <AnimatePresence mode="wait">
                <motion.div key={activeEvent} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.3}}>
                  <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14 }}>
                    <div>
                      <h3 style={{fontWeight:700,color:'#ffffff',margin:'0 0 4px'}}>{ev.title}</h3>
                      <div style={{display:'flex',gap:12,fontSize:11,color:'rgba(255,255,255,0.4)'}}>
                        <span style={{display:'flex',alignItems:'center',gap:4}}><Clock size={10}/>{ev.time}</span>
                        <span style={{display:'flex',alignItems:'center',gap:4}}><MapPin size={10}/>{ev.location}</span>
                      </div>
                    </div>
                    <span style={{fontSize:9,fontWeight:700,padding:'4px 10px',borderRadius:999,border:`1px solid ${ev.color}50`,backgroundColor:`${ev.color}18`,color:ev.color}}>RSVP OPEN</span>
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:6}}>
                      <span>Capacity</span><span style={{color:ev.color,fontWeight:600}}>{ev.rsvp} / {ev.cap}</span>
                    </div>
                    <div style={{height:6,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:999,overflow:'hidden'}}>
                      <motion.div style={{height:'100%',backgroundColor:ev.color,borderRadius:999}} initial={{width:0}} animate={{width:`${(ev.rsvp/ev.cap)*100}%`}} transition={{duration:0.8,ease:'easeOut'}}/>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
                {[{icon:QrCode,label:'Check-ins',value:'312',sub:'via QR scan',color:'#ffffff'},{icon:Bell,label:'Updates',value:'Live',sub:'instant push',color:'#34d399'}].map(({icon:Icon,label,value,sub,color})=>(
                  <div key={label} style={{backgroundColor:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:12}}>
                    <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',display:'flex',alignItems:'center',gap:4,margin:'0 0 4px'}}><Icon size={9}/>{label}</p>
                    <p style={{fontSize:18,fontWeight:700,color,margin:'0 0 2px'}}>{value}</p>
                    <p style={{fontSize:10,color:'rgba(255,255,255,0.3)',margin:0}}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────
function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  return (
    <section id="how-it-works" ref={ref} style={{ padding: '120px 32px', backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 20 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div initial={{opacity:0,y:30}} animate={inView?{opacity:1,y:0}:{}} transition={{duration:0.6}} style={{textAlign:'center',marginBottom:72}}>
          <span style={{color:'#818cf8',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.25em',display:'block',marginBottom:16}}>How it works</span>
          <h2 style={{fontSize:'clamp(2rem, 4vw, 3rem)',fontWeight:800,letterSpacing:'-0.03em',color:'#ffffff',margin:0}}>Four steps. That's it.</h2>
        </motion.div>
        <div style={{position:'relative'}}>
          <div style={{position:'absolute',left:27,top:28,bottom:28,width:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
          <div style={{display:'flex',flexDirection:'column',gap:44}}>
            {STEPS.map((step,i)=>(
              <motion.div key={step.n} initial={{opacity:0,x:-30}} animate={inView?{opacity:1,x:0}:{}} transition={{duration:0.6,delay:i*0.12}} style={{display:'flex',gap:28,alignItems:'flex-start'}}>
                <div style={{width:56,height:56,borderRadius:16,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,backgroundColor:i%2===0?'rgba(99,102,241,0.15)':'rgba(16,185,129,0.15)',border:`1px solid ${i%2===0?'rgba(99,102,241,0.3)':'rgba(16,185,129,0.3)'}`,color:i%2===0?'#818cf8':'#34d399'}}>{step.n}</div>
                <div style={{paddingTop:6}}>
                  <h3 style={{fontSize:18,fontWeight:700,color:'#ffffff',margin:'0 0 8px'}}>{step.title}</h3>
                  <p style={{fontSize:15,color:'rgba(255,255,255,0.5)',lineHeight:1.7,margin:0,maxWidth:560}}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────
function FeaturesGrid() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  return (
    <section id="features" ref={ref} style={{ padding: '120px 32px', backgroundColor: '#0F1117', position: 'relative', zIndex: 20 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div initial={{opacity:0,y:30}} animate={inView?{opacity:1,y:0}:{}} transition={{duration:0.6}} style={{textAlign:'center',marginBottom:60}}>
          <span style={{color:'#34d399',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.25em',display:'block',marginBottom:16}}>Features</span>
          <h2 style={{fontSize:'clamp(2rem, 4vw, 3rem)',fontWeight:800,letterSpacing:'-0.03em',color:'#ffffff',margin:'0 0 16px'}}>Everything you need.</h2>
          <p style={{fontSize:16,color:'rgba(255,255,255,0.4)',maxWidth:480,margin:'0 auto'}}>No extra tools. No switching tabs. UNIO covers the full event lifecycle in one place.</p>
        </motion.div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',gap:18}}>
          {FEATURES.map((f,i)=>(
            <motion.div key={f.title} initial={{opacity:0,y:30}} animate={inView?{opacity:1,y:0}:{}} transition={{duration:0.5,delay:i*0.08}} whileHover={{y:-4,transition:{duration:0.2}}} style={{backgroundColor:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:24}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:16}}>
                <div style={{width:40,height:40,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',backgroundColor:`${f.color}18`,border:`1px solid ${f.color}30`}}><f.icon size={18} color={f.color}/></div>
                <span style={{fontSize:22,fontWeight:800,color:f.color}}>{f.stat}</span>
              </div>
              <h3 style={{fontSize:15,fontWeight:700,color:'#ffffff',margin:'0 0 8px'}}>{f.title}</h3>
              <p style={{fontSize:13,color:'rgba(255,255,255,0.45)',lineHeight:1.65,margin:0}}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────
function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / 60;
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [inView, target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

function StatsBar() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  return (
    <section ref={ref} style={{ padding: '80px 32px', backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 20 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 32, textAlign: 'center' }}>
        {[{n:2400,s:'+',label:'Events managed'},{n:98000,s:'+',label:'QR check-ins'},{n:340,s:'+',label:'Campus clubs'},{n:97,s:'%',label:'Organizer satisfaction'}].map((stat,i)=>(
          <motion.div key={stat.label} initial={{opacity:0,y:20}} animate={inView?{opacity:1,y:0}:{}} transition={{duration:0.5,delay:i*0.1}}>
            <p style={{fontSize:40,fontWeight:800,color:'#ffffff',margin:'0 0 6px',letterSpacing:'-0.03em'}}><CountUp target={stat.n} suffix={stat.s}/></p>
            <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',margin:0}}>{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  return (
    <section id="get-started" ref={ref} style={{ padding: '120px 32px', backgroundColor: '#0F1117', position: 'relative', zIndex: 20 }}>
      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <motion.div initial={{opacity:0,scale:0.96}} animate={inView?{opacity:1,scale:1}:{}} transition={{duration:0.7}}
          style={{position:'relative',overflow:'hidden',borderRadius:48,background:'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(16,185,129,0.08) 100%)',border:'1px solid rgba(255,255,255,0.1)',padding:'80px 48px'}}>
          <div style={{position:'absolute',top:-60,left:'50%',transform:'translateX(-50%)',width:500,height:300,borderRadius:'50%',background:'rgba(99,102,241,0.12)',filter:'blur(80px)'}}/>
          <div style={{position:'absolute',bottom:-40,right:-40,width:400,height:250,borderRadius:'50%',background:'rgba(16,185,129,0.10)',filter:'blur(80px)'}}/>
          <div style={{position:'relative',zIndex:1}}>
            <span style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.3em',color:'rgba(255,255,255,0.3)',display:'block',marginBottom:24}}>Ready to get started?</span>
            <h2 style={{fontSize:'clamp(2.2rem, 5vw, 3.8rem)',fontWeight:800,letterSpacing:'-0.03em',lineHeight:1.05,color:'#ffffff',margin:'0 0 20px'}}>
              Your campus story <br/>starts with{' '}
              <span style={{background:'linear-gradient(to right, #818cf8, #34d399)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>UNIO.</span>
            </h2>
            <p style={{fontSize:16,color:'rgba(255,255,255,0.5)',maxWidth:480,margin:'0 auto 40px'}}>Join hundreds of campus clubs already using UNIO to run better events.</p>
            <div style={{display:'flex',flexWrap:'wrap',justifyContent:'center',gap:16}}>
              <Link href="/login" style={{display:'flex',alignItems:'center',gap:8,backgroundColor:'#6366F1',color:'#ffffff',padding:'14px 32px',borderRadius:999,fontSize:15,fontWeight:700,border:'none',cursor:'pointer',boxShadow:'0 8px 32px rgba(99,102,241,0.35)',textDecoration:'none'}}>
                Sign Up Free <ArrowRight size={16}/>
              </Link>
              <Link href="/login" style={{backgroundColor:'rgba(255,255,255,0.06)',color:'#ffffff',padding:'14px 32px',borderRadius:999,fontSize:15,fontWeight:700,border:'1px solid rgba(255,255,255,0.12)',cursor:'pointer',textDecoration:'none'}}>
                Log In
              </Link>
            </div>
          </div>
        </motion.div>
        <p style={{marginTop:40,fontSize:13,color:'rgba(255,255,255,0.2)'}}>© {new Date().getFullYear()} UNIO Campus · Where campus events come alive.</p>
      </div>
    </section>
  );
}
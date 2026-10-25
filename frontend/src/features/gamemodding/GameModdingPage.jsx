import content from '@content/gamemodding.json'
import ReadingTrack from '../courses/ReadingTrack.jsx'

export const GAMEMODDING_COURSES = content.courses

const track = {
  base: '/game-modding',
  courses: GAMEMODDING_COURSES,
  reviewedAt: content.reviewedAt,
  tag: 'Game Modding',
  codeExt: 'cpp',
  difficulties: ['Fundamental', 'Intermediate', 'Advanced'],
  haystack: 'game modding reverse engineering assembly hooking detours bepinex harmony unity unreal engine reflection memory scan pointer chain imgui pak save editor',
  eyebrow: 'Game Reverse Engineering · Runtime Detours & Mod Architecture',
  title: 'Game Modding & Reverse Engineering',
  intro: 'Master game modding from engine architectures and virtual memory scanning to native C++ detour hooking, Unity C# / BepInEx & Harmony patching, Unreal Engine reflection traversal, embedded Lua bridges, and asset/save file engineering — with complete source examples and course certificates.',
  metrics: '10 courses · 40 section checkpoints · 10 exams',
  continueLabel: 'Continue the Game Modding path',
  capstoneId: 'mod-capstone',
  capstoneLabel: 'Jump to the production capstone',
  allLabel: 'All Game Modding courses',
  searchLabel: 'Search Game Modding courses',
  disclosure: 'Study and take exams in any browser. Compiling native C++ hooks, building BepInEx plugins, or running save file tools requires your own local development environment (such as Visual Studio, GCC/Clang, .NET SDK, or Python 3) and a compatible game installation. VoltQuest does not execute native game binaries, hook running processes, or bypass multiplayer anti-cheat in the browser. Lab step checkboxes record your own observations and verify nothing.',
  codeNote: 'Copy or download this complete modding program, inspect the implementation, and compile or run it in your local environment. VoltQuest does not hook running games in the browser.',
  langNote: 'Game Modding course narratives, questions and code samples are currently in English. Interface controls and learning rewards support Indonesian.',
  reviewedNote: 'Game Modding techniques and architecture reviewed on {date}. Aligns with modern Unity (Mono/IL2CPP), Unreal Engine 4/5, BepInEx 5/6, and Harmony standards.',
}

export default function GameModdingPage() {
  return <ReadingTrack track={track} />
}

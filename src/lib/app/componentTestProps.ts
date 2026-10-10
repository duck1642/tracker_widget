import { vi } from "vitest";
import type { ComponentProps } from "svelte";
import type AppHeader from "./AppHeader.svelte";
import type PlanSection from "$lib/features/weekly/components/PlanSection.svelte";
import type ActualSection from "$lib/features/weekly/components/ActualSection.svelte";
import type ObjectiveRow from "$lib/features/weekly/components/ObjectiveRow.svelte";
import type SessionCard from "$lib/features/daily/components/SessionCard.svelte";
import type TodoRow from "$lib/features/todo/components/TodoRow.svelte";
import type ActivityRow from "$lib/features/daily/components/ActivityRow.svelte";

export function headerProps() {
  return {dragEnabled:true,layerMode:"normal",showModeMenu:false,onToggleSidebar:vi.fn(),onBack:vi.fn(),onForward:vi.fn(),onToggleModeMenu:vi.fn(),onSelectMode:vi.fn(),onToggleSettings:vi.fn(),onOpenView:vi.fn(),onOpenActiveFile:vi.fn(),onCreateCurrentWeek:vi.fn(),onCreateNextWeek:vi.fn(),onChooseWeeks:vi.fn(),onOpenHelp:vi.fn(),onShrinkApp:vi.fn(),onMaximizeApp:vi.fn(),onCloseApp:vi.fn()} satisfies ComponentProps<typeof AppHeader>;
}
export function planProps() {
  return {plan:[],toggleDay:vi.fn(),onAdd:vi.fn(),onUpdate:vi.fn(),onDelete:vi.fn(),onAddActivity:vi.fn(),onUpdateActivity:vi.fn(),onDeleteActivity:vi.fn(),onMoveActivity:vi.fn()} satisfies ComponentProps<typeof PlanSection>;
}
export function actualProps() {
  return {actual:[],onRefresh:vi.fn(),toggleDay:vi.fn()} satisfies ComponentProps<typeof ActualSection>;
}
export function objectiveProps() {
  return {objective:{id:"objective",subjects:[],status:"open",description:"",indent:0},onToggleFold:vi.fn(),onUpdate:vi.fn(),onDelete:vi.fn(),onMoveUp:vi.fn(),onMoveDown:vi.fn(),onOpenContextMenu:vi.fn()} satisfies ComponentProps<typeof ObjectiveRow>;
}
export function sessionProps() {
  return {session:{id:"session",name:"",activities:[]},onAddActivity:vi.fn(),onUpdateActivity:vi.fn(),onDeleteActivity:vi.fn(),onMoveActivity:vi.fn(),onDeleteSession:vi.fn(),onRenameSession:vi.fn(()=>true)} satisfies ComponentProps<typeof SessionCard>;
}
export function rowProps() {
  return {todo:{id:"todo",isTodo:true,text:"",checked:false,indent:0},index:0,inputElements:{},onToggleTodo:vi.fn(),onToggleFold:vi.fn(),onUpdateText:vi.fn(),onMoveTodoToVisiblePosition:vi.fn(async()=>true),onFocus:vi.fn(),onBlur:vi.fn(),onKeyDown:vi.fn(),onSelectTodo:vi.fn(),onSetSelectionAnchor:vi.fn(),onClearSelection:vi.fn(),onOpenContextMenu:vi.fn()} satisfies ComponentProps<typeof TodoRow>;
}
export function activityProps() {
  return {activity:{id:"activity",subjects:[],minutes:0,description:""},onUpdate:vi.fn(),onDelete:vi.fn(),onMoveUp:vi.fn(),onMoveDown:vi.fn()} satisfies ComponentProps<typeof ActivityRow>;
}

export type ExerciseType = 'letra' | 'silaba' | 'palavra' | 'frase' | 'sequencia'

export interface Exercise {
  id: string
  type: ExerciseType
  /** Clip único (telas de 1 caractere) */
  audio?: string
  /** Clips em ordem (telas compostas) */
  audioSequence?: string[]
  answer: string
}

export interface SessionState {
  exercises: Exercise[]
  index: number
  /** Exercícios concluídos com sucesso nesta sessão */
  completed: number
  /** Erros de tecla (char errado) nesta sessão */
  mistakes: number
  /** Índice do próximo caractere a digitar em answer */
  cursor: number
  /** Prefixo já revelado (acertado) */
  revealed: string
  /** Exercício atual concluído (todos os chars) */
  exerciseDone: boolean
  /** Sessão inteira concluída */
  sessionDone: boolean
}

export type KeyResult =
  | { kind: 'ignored' }
  | { kind: 'correct'; session: SessionState }
  | { kind: 'incorrect'; session: SessionState }
  | { kind: 'complete'; session: SessionState }

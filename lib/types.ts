export type Profile = {
  id: string
  display_name: string
  created_at: string
}

export type Prompt = {
  id: string
  text: string
  max_response_chars: number
  created_at: string
}

export type Period = {
  id: string
  prompt_id: string
  started_at: string
  ended_at: string | null
  prompt?: Prompt
}

export type Response = {
  id: string
  period_id: string
  user_id: string
  content: string
  is_draft: boolean
  is_public: boolean
  submitted_at: string | null
  created_at: string
  updated_at: string
  profile?: Profile
  period?: Period
}

export type Comment = {
  id: string
  response_id: string
  user_id: string
  content: string
  created_at: string
  profile?: Profile
}

export type Invitation = {
  id: string
  email: string
  invited_by: string
  created_at: string
  accepted_at: string | null
}

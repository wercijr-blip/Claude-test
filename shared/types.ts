export type Role = 'admin' | 'doctor'

export interface UserProfile {
  id:                     number
  email:                  string
  name:                   string | null
  role:                   Role
  clinicId:               string | null
  specialty:              string | null
  crm:                    string | null
  active:                 number
  mustChangePassword:     number
  bulletinEmail:          string | null
  receiveMonthlyBulletin: number
}

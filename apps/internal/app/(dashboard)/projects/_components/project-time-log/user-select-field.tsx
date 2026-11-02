import { EntityFieldLabel } from '@/components/ui/entity-label-icon'
import {
  SearchableCombobox,
  type SearchableComboboxItem,
} from '@/components/ui/searchable-combobox'

export type UserSelectFieldProps = {
  selectedUserId: string
  onSelectUser: (value: string) => void
  items: SearchableComboboxItem[]
  disabled: boolean
  fieldErrorId?: string
  errorMessage?: string | null
}

export function UserSelectField(props: UserSelectFieldProps) {
  const {
    selectedUserId,
    onSelectUser,
    items,
    disabled,
    fieldErrorId,
    errorMessage,
  } = props

  return (
    <div className='space-y-2 sm:col-span-2'>
      <EntityFieldLabel entity='contact' htmlFor='time-log-user'>
        Log hours for
      </EntityFieldLabel>
      <SearchableCombobox
        id='time-log-user'
        value={selectedUserId}
        onChange={onSelectUser}
        items={items}
        placeholder='Select teammate'
        searchPlaceholder='Search people…'
        emptyMessage='No eligible collaborators found.'
        disabled={disabled}
        ariaDescribedBy={fieldErrorId}
        ariaInvalid={Boolean(errorMessage)}
      />
      {errorMessage ? (
        <p id={fieldErrorId} className='text-destructive text-xs' role='alert'>
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}

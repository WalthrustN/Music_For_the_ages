import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'

export function usePlaylists() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['playlists'], queryFn: api.playlists })

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ['playlists'] })
  }

  const create = useMutation({
    mutationFn: api.createPlaylist,
    onSuccess: () => { void refresh() },
  })
  const add = useMutation({
    mutationFn: ({ id, songIds }: { id: number; songIds: number[] }) => api.addToPlaylist(id, songIds),
    onSuccess: () => { void refresh() },
  })
  const remove = useMutation({
    mutationFn: ({ id, songId }: { id: number; songId: number }) => api.removeFromPlaylist(id, songId),
    onSuccess: () => { void refresh() },
  })
  const random = useMutation({
    mutationFn: api.randomPlaylist,
    onSuccess: () => { void refresh() },
  })
  const removeList = useMutation({
    mutationFn: api.deletePlaylist,
    onSuccess: () => { void refresh() },
  })

  return { query, create, add, remove, random, removeList }
}

import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    nowDate: Date.now(),
    tracks: {},
    albums: {},
    artists: {},
    users: {}
  },
  mutations: {
    saveTrack(state, { id, track }) {
      state.tracks[id] = track
    },
    saveAlbum(state, { id, album }) {
      state.albums[id] = album
    },
    saveArtist(state, { id, artist }) {
      state.artists[id] = artist
    },
    setNowDate(state, date) {
      state.nowDate = date
    },
    updateUser(state, { userId, data }) {
      state.users[userId] = Object.assign({}, state.users[userId], data)
    },
    reinitUsers(state) {
      state.users = { ...state.users }
    }
  },
  actions: {
    updateNow({ commit }) {
      commit('setNowDate', Date.now())
    },
    saveTracks({ commit, state }, tracks) {
      for (const track of tracks) {
        if (track.id in state.tracks) continue
        commit('saveTrack', {
          id: track.id,
          track: {
            id: track.id,
            album: track.album.id,
            artists: track.artists.map(artist => artist.id),
            name: track.name,
            duration: track.duration_ms
          }
        })
        for (const artist of track.artists) {
          if (artist.id in state.artists) continue
          commit('saveArtist', {
            id: artist.id,
            artist: {
              id: artist.id,
              name: artist.name
            }
          })
        }
        if (!(track.album.id in state.albums))
          commit('saveAlbum', {
            id: track.album.id,
            album: {
              id: track.album.id,
              name: track.album.name,
              images: track.album.images
            }
          })
      }
    },
    updateUser({ commit }, { userId, data }) {
      commit('updateUser', { userId, data })
    },
    reinitUsers({ commit }) {
      commit('reinitUsers')
    }
  }
})

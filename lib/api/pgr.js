import { GAMES } from "../constants.js"
import KuroClient from "./kuro.js"

export default class PgrApi extends KuroClient {
  constructor() {
    super()
    this.gameId = GAMES.pgr.id
  }
}

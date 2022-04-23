import Phaser from "phaser";
import Boot from "./scenes/Boot.js";
import Preloader, { authEvents, AUTH } from "./scenes/Preloader.js";
import MainMenu, { nftEvents, LOAD_NFT } from "./scenes/MainMenu.js";
import MainGame from "./scenes/Game.js";
import { useState, useEffect } from "react";
import { createStore, applyMiddleware } from "redux";
import thunkMiddleware from "redux-thunk";
import { createLogger } from "redux-logger";

import axios from "axios";

import { useMoralis, useNFTBalances } from "react-moralis";

let game = null;

const initState = { player: {}, score: 0, nft: "", gameOver: false };

//event types
export const GET_PLAYER = "GET_PLAYER";
export const LOGIN_PLAYER = "LOGIN_PLAYER";
export const UPDATE_SCORE = "UPDATE_SCORE";
export const GAME_OVER = "GAME_OVER";

function reducer(state = initState, action) {
  switch (action.type) {
    case GET_PLAYER:
      return { ...state, player: action.player };
    case LOGIN_PLAYER:
      game.events.emit("LOGIN_PLAYER", "Login player");
      return { ...state, score: action.score };
    case UPDATE_SCORE:
      return { ...state, score: action.score };
    case GAME_OVER:
      return { ...state, score: action.score, gameOver: true };
    default:
      return state;
  }
}

// redux
export const events = createStore(
  reducer,
  applyMiddleware(thunkMiddleware, createLogger())
);

function App() {
  const { authenticate, isAuthenticated, user, logout } = useMoralis();
  const [loaded, setLoaded] = useState(false);

  function startGame(_user, _demoNFTimage) {
    console.log("USER:", _user);
    // communicate to Phaser game that player is authenticated
    authEvents.dispatch({ type: AUTH, player: _user });
  }

  const { getNFTBalances } = useNFTBalances();

  const check_address = "0xfc96bb987301805d3b5c20006df7576b381c8949";
  const network_chain_id = "0x13881";

  const nftMetadata = [];
  const findNFTMetadata = async (___data) => {
    let p = 0;
    for (let i = 0; i < ___data.length; i++) {
      console.log(___data[i].token_address);
      if (___data[i].token_address === check_address) {
        console.log(___data[i].token_uri);
        nftMetadata[p] = ___data[i].token_uri;
        p++;
      }
    }
  };

  let demoNFTimageURL =
    "https://opensea.mypinata.cloud/ipfs/QmbnCCaG7W8PyMvAztSb2hQqKrrqv2z8Qh25aMuqeimdsg/11.png";
  const getJSON = async (_metadata) => {
    try {
      // grab remote json file (likely IPFS)
      await axios.get(_metadata).then((res) => {
        console.log("Initial Image URL:", res.data?.image);
        // set URL
        demoNFTimageURL = res.data?.image;

        if (demoNFTimageURL.match("moralis")) {
        } else {
          console.log("here");
          let imageSplit = res.data?.image.split("/");
          console.log("IMAGE CID:", res.data?.image.split("/"));
          demoNFTimageURL =
            "https://opensea.mypinata.cloud/ipfs/" +
            imageSplit[2] +
            "/" +
            imageSplit[3];
        }
      });
    } catch (error) {
      console.error(error);
    }
  };

  const compileNFT = async (___user, __data) => {
    await findNFTMetadata(__data);
    await getJSON(nftMetadata[0]);
    console.log("Final NFT Image URL:", demoNFTimageURL);

    if (demoNFTimageURL === "") {
      alert("Something Went wrong. Reload?");
    } else {
      nftEvents.dispatch({ type: LOAD_NFT, nft: demoNFTimageURL });
      startGame(___user, demoNFTimageURL);
    }
  };

  const checkNFTBalance = async (__user) => {
    let valid = false;
    await getNFTBalances({
      params: {
        chain: network_chain_id,
      },
    })
      .then(function (_data) {
        console.log(_data);

        if (!_data || _data?.result.length === 0) {
          // no NFTs returned = false
          console.log("Nope");
          authEvents.dispatch({ type: AUTH, player: null });
          logout();
          console.log("User logged-out");
        } else {
          valid = _data.result.some(
            (elem) => elem.token_address === check_address
          );

          if (valid) {
            console.log("ACCESS GRANTED", valid);

            compileNFT(__user, _data.result);
          } else {
            alert("ACCESS DENIED: No Valid NFT");
            console.log("ACCESS DENIED: No Valid NFT");
          }
        }
      })
      .catch(function (error) {
        console.log(error);
      });
    return valid;
  };

  const login = async () => {
    if (!isAuthenticated) {
      await authenticate({ signingMessage: "Log in using Moralis" })
        .then(function (_user) {
          console.log("logged in user:", _user);
          console.log(_user?.get("ethAddress"));
          console.log("Is Authenticated:", isAuthenticated);
          if (!_user) {
            authEvents.dispatch({ type: AUTH, player: null });
            logout();
            console.log("logged out");
          } else {
            checkNFTBalance(_user);
          }
        })
        .catch(function (error) {
          console.log(error);
        });
    }
  };

  if (!loaded) {
    setLoaded(true);
    const config = {
      type: Phaser.AUTO,
      parent: "game-container",
      autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      autoFocus: true,
      fps: {
        target: 60,
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 200 },
          debug: false,
        },
      },
      backgroundColor: "#282c34",
      scale: {
        mode: Phaser.Scale.ScaleModes.NONE,
      },
      scene: [Boot, Preloader, MainMenu, MainGame],
    };

    if (game === null) {
      game = new Phaser.Game(config);

      game.events.on("LOGIN_PLAYER", (event) => {
        console.log("⛓⛓⛓ Login via Web3 Wallet ⛓⛓⛓");

        login();
      });
    }

    game.events.on("BLOCK_CHECK", (event) => {
      console.log("⛓⛓⛓ Game Event Triggered Web3 Func ⛓⛓⛓");
      fetch();
    });
  }

  return <></>;
}

export default App;
